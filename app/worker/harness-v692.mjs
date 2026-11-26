// harness-v692.mjs — v692: starter profiles + the
// today/standing toggle (Plan §2.9 + the scope
// document's A picks Q1–Q10 + W, the web Benedictine).
//
// Chromium (playwright-core), on the pattern of
// harness-v690.mjs: the REAL built Worker bundle served
// locally; the public shell shape (window.__OPN_SHAPE__
// = "public") so opnMode() resolves — device legs via
// the installed-PWA matchMedia seam (opnInstalledPwa),
// web legs without it. Personal data runs through the
// REAL on-device layer (opnDoc / opnLocalApi) over
// localStorage documents seeded per fixture; the
// network is stubbed for the day / settings / book /
// podcasts reads only.
//
// Fixtures (Improvement D — production shapes, sources
// named):
//  F1 John's "Daily": the v690 harness's JOHN_CONTENTS
//     (his real Morning/Midday lists, field-reported
//     2026-11-26) on a custom slug-keyed profile, his
//     standing pick, a REAL today layer standing
//     (divergent contents), the three Ways standing in
//     the list as defaults (his pre-v692 device shape).
//  F2 fresh install: no stored document at all.
//  F3 Ways-pick device: standing pick = salesian; the
//     Way records stand in the list in their post-mig609
//     shape (built in-page by the REAL
//     opnStarterRecord692 transform) with an in-place
//     edit on the Salesian record (an added block + an
//     added Night item); one today layer based on
//     salesian.
//  F4 a copied-from-a-Way own profile (Save New's slug
//     mint of the starter template) standing beside the
//     defaults, itself the standing pick.
//  PHANTOM: F1's shape with the today entry replaced by
//     the opnWriteShape607 seed shape — coreBlocks +
//     layers carried, exactly equal to the profile (no
//     today act ever made).
//
// Legs: Plan §2.9 legs 1–8 extended with the Q2/Q4/Q5/
// Q6/Q9 legs, the PHANTOM-EDITS legs, and the WEB leg,
// per the Implement brief. COMPOSED lines print FIRST —
// run with ORA_WT=<pre-change tree> and diff them for
// leg 8 (F1 composition byte-identical).
//
// Run: node app/worker/harness-v692.mjs
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

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
check('F today (America/Chicago) stands for the fixtures', /^\d{4}-\d{2}-\d{2}$/.test(TODAY), TODAY);

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
const LAYERS_OFF = { novenas: { on: false }, podcasts: { on: false, series: [] } };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v692harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL0 = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const SHELL = SHELL0.replace('window.__OPN_SHAPE__="private"', 'window.__OPN_SHAPE__="public"');
check('F the public shell shape stands for the mode legs', SHELL.includes('window.__OPN_SHAPE__="public"'));
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- the stub world + fixture builders (in-page) ----------
const b = await chromium.launch({ executablePath: EXE });
async function newDevicePage() {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
  await pg.addInitScript(({ SEED, TODAY }) => {
    // Installed-PWA seam: opnInstalledPwa() reads
    // matchMedia('(display-mode: standalone)').
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => String(q).includes('standalone')
      ? { matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }
      : mm(q);
    const clone = (x) => JSON.parse(JSON.stringify(x));
    window.__mkDay692 = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay692(m ? m[1] : TODAY)); }
      if (u.includes('/api/player/source-settings')) return resp({ ok: true, version: 1, sources: clone(SEED) });
      if (u.includes('/api/prayer/book')) return resp({ ok: true, groups: [] });
      if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
      if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
      return new Promise(() => {});
    };
  }, { SEED, TODAY });
  await pg.goto('http://127.0.0.1:' + PORT + '/');
  await pg.waitForTimeout(1600);
  return pg;
}

// Fixture doc builders — evaluated in-page so the Ways
// stand in their REAL post-mig609 shape (the seed record
// + opnMigrateProfileRecord609 — the production
// transform opnStarterRecord692 wraps; spelled out here
// so the COMPOSED gate also runs on the pre-v692 tree).
async function buildFixtures(pg) {
  return pg.evaluate(({ JOHN_CONTENTS, JOHN_CORE, LAYERS_OFF, TODAY }) => {
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const starter = (key) => {
      const seed = OPN_SEED_PROFILES.filter((d) => d.key === key)[0];
      const r = clone(seed);
      opnMigrateProfileRecord609(r, opnDoc().sections);
      return r;
    };
    window.__starter692 = starter;
    const daily = { key: 'daily', name: 'Daily', honorLine: '', kind: 'custom', coreBlocks: JOHN_CORE.slice(), layers: clone(LAYERS_OFF), contents: clone(JOHN_CONTENTS) };
    const realLayer = { baseProfileKey: 'daily', contents: { Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }] } };
    const doc = (profiles) => ({
      format: 'orapronobis-personal-data', formatVersion: 1, exportedAt: null,
      sections: {
        intentions: [],
        conscience: { runs: [], entries: [], confessions: [], promptTexts: {}, guideSteps: null },
        profiles,
        config: { sourceSettings: { version: 1, sources: clone(opnDoc().sections.config.sourceSettings.sources) }, blockOrder: null, massSeats: { before: [], after: [], afterMass: [], preMass: [] }, universalPrayer: {}, addenda: {} },
        favorites: { book: [], starred: [] },
      },
      seq: { intention: 1, run: 1, entry: 1, confession: 1 },
    });
    const profSection = (list, standingKey, todayEdits) => ({ list, standingKey, version: 3, mig590: true, mig604: true, mig609: true, todayEdits: todayEdits || {} });
    // F1: Daily + the three Ways standing, Daily the pick, a real today layer.
    const F1 = doc(profSection([starter('little-way'), starter('salesian'), starter('benedictine'), clone(daily)], 'daily', { [TODAY]: clone(realLayer) }));
    // F1 gate variant: Daily alone (no migration trigger over the pick).
    const F1G = doc(profSection([clone(daily)], 'daily', { [TODAY]: clone(realLayer) }));
    // PHANTOM: F1's doc with the shape-seeded equal layer.
    const phantomLayer = { baseProfileKey: 'daily', coreBlocks: JOHN_CORE.slice(), layers: clone(LAYERS_OFF) };
    const PH = doc(profSection([clone(daily)], 'daily', { [TODAY]: phantomLayer }));
    // F3: Ways-pick device — salesian carries an in-place edit.
    const sal = starter('salesian');
    sal.coreBlocks = ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'];
    sal.contents = clone(sal.contents || {}); sal.contents.Night = (sal.contents.Night || []).concat([{ kind: 'prayer', key: 'angelus-midday' }]);
    const F3 = doc(profSection([starter('little-way'), sal, starter('benedictine')], 'salesian',
      { [TODAY]: { baseProfileKey: 'salesian', contents: { Midday: [{ kind: 'prayer', key: 'angelus-midday' }] } } }));
    // F4: a Save-New copy of the Benedictine starter beside the defaults; the copy is the pick.
    const copy = starter('benedictine');
    copy.kind = 'custom'; copy.key = 'the-benedictine-way';
    const F4 = doc(profSection([starter('little-way'), starter('salesian'), starter('benedictine'), copy], 'the-benedictine-way', {}));
    window.__FIX692 = { F1, F1G, PH, F3, F4, daily, realLayer };
    window.__setDoc692 = (d) => { localStorage.setItem('opn-personal-data-v1', JSON.stringify(d)); opnDocCache = null; opn604.res = null; };
    window.__readDoc692 = () => JSON.parse(localStorage.getItem('opn-personal-data-v1'));
    return { salCore: sal.coreBlocks, salNight: sal.contents.Night.length, today: TODAY };
  }, { JOHN_CONTENTS, JOHN_CORE, LAYERS_OFF, TODAY });
}

const pg = await newDevicePage();
check('D device mode stands through the installed-PWA seam', await pg.evaluate(() => opnMode()), 'device');
const fixInfo = await buildFixtures(pg);
await pg.evaluate(() => opnEnsureStandings601());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- L8 gate lines (printed first) ----------
// F1G (no migration trigger over the pick): the composed
// day for a weekday + a Sunday, before/after the build.
async function composedLines() {
  return pg.evaluate(({ TODAY }) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1G)));
    const out = [];
    for (const date of ['2026-11-26', '2026-11-29']) {
      const day = window.__mkDay692(date);
      const folded = opnScrubDayPayload(JSON.parse(JSON.stringify(day)));
      const p = folded.profile || {};
      out.push('COMPOSED daily ' + date + ' ' + JSON.stringify({ key: p.key, name: p.name, core: p.coreBlocks, contents: p.contents || null, blocks: (folded.blocks || []).map((x) => x.block) }));
    }
    return out;
  }, { TODAY });
}
const compLines = await composedLines().catch((e) => ['ERROR ' + String(e).slice(0, 200)]);
compLines.forEach((l) => console.log(l));
check('L8 GATE composition lines stand for the untouched Daily x Thu/Sunday', compLines.length === 2 && compLines.every((l) => l.startsWith('COMPOSED daily ')), compLines);

// ---------- Leg 1 + migration over F1 (Daily pick, Ways standing) ----------
{
  const r = await pg.evaluate(({ TODAY }) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1)));
    const P = opnDoc().sections.profiles;
    const payload = opnProfilesPayload(TODAY);
    opn604.res = payload;
    const chips = opnPickHead609();
    return {
      keys: P.list.map((p) => p.key), kinds: P.list.map((p) => p.kind),
      standing: P.standingKey, mig692: !!P.mig692,
      layer: P.todayEdits[TODAY] || null,
      payloadKinds: payload.profiles.map((p) => p.kind), payloadKeys: payload.profiles.map((p) => p.key),
      chips,
    };
  }, { TODAY });
  check('L1 migration over F1: the Ways leave the list; Daily stands alone as the only profile', r.keys.length === 1 && r.keys[0] === 'daily' && r.kinds[0] === 'custom', r.keys);
  check('L1 the standing pick stands on Daily; mig692 stands spent', r.standing === 'daily' && r.mig692 === true, r);
  check('L1 F1 real today layer stands byte-identical after migration (base daily, divergent contents)',
    !!r.layer && r.layer.baseProfileKey === 'daily' && JSON.stringify(r.layer.contents) === JSON.stringify({ Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }] }), r.layer);
  check('L1 both payloads\u2019 shape (client opnProfilesPayload): no kind default, no default key',
    r.payloadKinds.every((k) => k !== 'default') && !r.payloadKeys.some((k) => ['little-way', 'salesian', 'benedictine'].includes(k)), r.payloadKeys);
  check('L1 chips name no Way on the Daily-only list', !/The (Little|Salesian|Benedictine) Way/.test(r.chips) && r.chips.includes('Daily'), r.chips.slice(0, 200));
}

// ---------- Leg 5: F3 Ways-pick migration ----------
let f3CopyKey = null;
{
  const r = await pg.evaluate(({ TODAY }) => {
    const before = JSON.parse(JSON.stringify(window.__FIX692.F3));
    const salBefore = before.sections.profiles.list.filter((p) => p.key === 'salesian')[0];
    window.__setDoc692(before);
    const P = opnDoc().sections.profiles;
    const after1 = JSON.stringify(P);
    opnDocCache = null; // second load
    const P2 = opnDoc().sections.profiles;
    const copy = P.list.filter((p) => p.startedFrom === 'salesian')[0] || null;
    return {
      keys: P.list.map((p) => p.key), standing: P.standingKey,
      copy: copy ? { key: copy.key, name: copy.name, kind: copy.kind, core: copy.coreBlocks, contents: copy.contents, startedFrom: copy.startedFrom } : null,
      salBefore: { core: salBefore.coreBlocks, contents: salBefore.contents },
      layer: P.todayEdits[TODAY] || null,
      onceOnly: after1 === JSON.stringify(P2),
    };
  }, { TODAY });
  f3CopyKey = r.copy && r.copy.key;
  check('L5 F3 migrates: exactly one own profile stands (the copy); the other Ways leave without copies', r.keys.length === 1 && !!r.copy, r.keys);
  check('L5 the copy carries the Way\u2019s name + kind custom + provenance startedFrom=salesian (Q6 A)', !!r.copy && r.copy.name === 'The Salesian Way' && r.copy.kind === 'custom' && r.copy.startedFrom === 'salesian', r.copy);
  check('L5 the copy key is the slug + -own mint, never a default key', !!r.copy && r.copy.key === 'the-salesian-way-own', r.copy && r.copy.key);
  check('L5 the standing pick re-points at the copy', r.standing === 'the-salesian-way-own', r.standing);
  check('L5 the Way AS IT STANDS is preserved whole (in-place edit: coreBlocks + Night contents ride)',
    !!r.copy && JSON.stringify(r.copy.core) === JSON.stringify(r.salBefore.core) && JSON.stringify(r.copy.contents) === JSON.stringify(r.salBefore.contents), { copy: r.copy, before: r.salBefore });
  check('L5 the today layer\u2019s baseProfileKey re-points at the copy', !!r.layer && r.layer.baseProfileKey === 'the-salesian-way-own', r.layer);
  check('L5 a second load changes nothing (one-time)', r.onceOnly === true);
  // Q6 A sub-line at the plan-row meta seat.
  const sub = await pg.evaluate(({ TODAY }) => {
    const day = opnScrubDayPayload(window.__mkDay692(TODAY));
    return profPlanRowHtml(day);
  }, { TODAY });
  check('L5/Q6 the plan row paints the sub-line "Your profile — started from The Salesian Way"', sub.includes('Your profile — started from The Salesian Way'), sub.slice(0, 300));
}

// ---------- Leg 6: F4 byte-identical ----------
{
  const r = await pg.evaluate(() => {
    const before = JSON.parse(JSON.stringify(window.__FIX692.F4));
    const copyBefore = JSON.stringify(before.sections.profiles.list.filter((p) => p.key === 'the-benedictine-way')[0]);
    window.__setDoc692(before);
    const P = opnDoc().sections.profiles;
    const copyAfter = JSON.stringify(P.list.filter((p) => p.key === 'the-benedictine-way')[0]);
    return { identical: copyBefore === copyAfter, keys: P.list.map((p) => p.key), standing: P.standingKey };
  });
  check('L6 F4: the copied-from-a-Way own profile stands byte-identical after migration', r.identical === true, r.keys);
  check('L6 F4: the defaults leave; the pick stands on the copy', r.keys.length === 1 && r.standing === 'the-benedictine-way', r);
}

// ---------- Leg 2 + Q2 A: F2 startup offer + mint ----------
{
  const r = await pg.evaluate(() => {
    localStorage.removeItem('opn-personal-data-v1');
    opnDocCache = null; opn604.res = null;
    const P = opnDoc().sections.profiles;
    return { list: P.list.length, standing: P.standingKey, offer: opnStarterOfferStands692(), html: opnStarterOfferHtml692() };
  });
  check('L2 F2: a fresh store is born with list [] and standingKey null (no pick names a default)', r.list === 0 && r.standing === null, r);
  check('L2 F2: the starter offer stands (Q1 A)', r.offer === true);
  check('L2 F2: the offer carries exactly the three starters with honor lines + Q8 guidance + the becoming-yours line',
    ['little-way', 'salesian', 'benedictine'].every((k) => r.html.includes('data-p692starter="' + k + '"'))
    && (r.html.match(/named in honor of the tradition/g) || []).length === 3
    && r.html.includes('Two anchors in the day') && r.html.includes('Prayer at the day’s hinges') && r.html.includes('Every hour of the day')
    && (r.html.match(/Becomes your own profile/g) || []).length === 3, r.html.slice(0, 300));
  check('L2/Q4 the startup offer carries NO "Start empty" row', !r.html.includes('Start empty') && !r.html.includes('data-p692empty'));
  check('L2 the Salesian card stands pre-highlighted', /p692card on" data-p692starter="salesian"/.test(r.html), r.html.slice(0, 400));
  // Paint the home and tap the Salesian card (the real wiring).
  await pg.evaluate(({ TODAY }) => {
    state.dayPayload = window.__mkDay692(TODAY);
    state.prayersView = { kind: 'home' };
    paintPrayersView(state.dayPayload);
  }, { TODAY });
  await sleep(300);
  check('L2 the painted home stands the offer in place of the set', await pg.evaluate(() => !!document.querySelector('[data-p692offer]')));
  await pg.click('[data-p692starter="salesian"]');
  await sleep(1200);
  const m = await pg.evaluate(() => {
    const P = opnDoc().sections.profiles;
    const rec = P.list[0] || null;
    return { n: P.list.length, standing: P.standingKey, rec: rec ? { key: rec.key, name: rec.name, kind: rec.kind, core: rec.coreBlocks } : null, renameStood: !!document.querySelector('.profrename590') };
  });
  check('L2/Q2 the pick mints ONE own profile named for its starter — no name step stood', m.n === 1 && !!m.rec && m.rec.name === 'The Salesian Way' && m.renameStood === false, m);
  check('L2 the mint key is the name slug (the-salesian-way), NOT a default key; kind custom', !!m.rec && m.rec.key === 'the-salesian-way' && m.rec.kind === 'custom', m.rec);
  check('L2 the standing pick names the mint; the Praylist resolves to it', m.standing === 'the-salesian-way'
    && await pg.evaluate(({ TODAY }) => { const p = opnProfilesPayload(TODAY); return p.effective && p.effective.key === 'the-salesian-way'; }, { TODAY }));
  const m2 = await pg.evaluate(() => new Promise((done) => {
    opnMintStarter692('salesian', (mint) => {
      const P = opnDoc().sections.profiles;
      done({ n: P.list.length, mintKey: mint && mint.key, mintName: mint && mint.name, standing: P.standingKey });
    });
  }));
  check('L2/Q2 a second mint from the same starter dedupes the KEY and keeps the name', m2.n === 2 && m2.mintKey === 'the-salesian-way-2' && m2.mintName === 'The Salesian Way' && m2.standing === 'the-salesian-way-2', m2);
}

// ---------- Leg 3: Reset on F1 (route + menu seats) ----------
{
  const r = await pg.evaluate(({ TODAY }) => new Promise((done) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1)));
    opnDoc(); // migration runs
    profPut('/api/prayer/profiles/reset', { profileKey: 'daily', starterKey: 'benedictine' }).then((res) => {
      const P = opnDoc().sections.profiles;
      const rec = P.list.filter((p) => p.key === 'daily')[0];
      const starter = window.__starter692('benedictine');
      done({
        coreSame: JSON.stringify(rec.coreBlocks) === JSON.stringify(starter.coreBlocks),
        layersSame: JSON.stringify(opnLayersOut(rec.layers)) === JSON.stringify(opnLayersOut(starter.layers)),
        contentsSame: JSON.stringify(rec.contents || null) === JSON.stringify(starter.contents || null),
        key: rec.key, name: rec.name, standing: P.standingKey, layer: P.todayEdits[TODAY] || null,
      });
    }).catch((e) => done({ error: String(e && e.message || e) }));
  }), { TODAY });
  check('L3 Reset replaces coreBlocks/layers/contents with the starter\u2019s post-mig609 shape', r.coreSame && r.layersSame && r.contentsSame, r);
  check('L3 Reset PRESERVES key, name, the standing pick, and the today layer', r.key === 'daily' && r.name === 'Daily' && r.standing === 'daily' && !!r.layer && r.layer.baseProfileKey === 'daily', r);
}

// ---------- Leg 4 + Q4 A: Add mints ----------
{
  // The pick sheet from the ADD seat only carries Start empty.
  const sheets = await pg.evaluate(() => {
    opnOpenStarterPick692({ title: 'Add', includeEmpty: true, onPick: () => {} });
    const withEmpty = !!document.querySelector('[data-p692empty]');
    document.querySelector('.p692pick').remove();
    opnOpenStarterPick692({ title: 'Reset', onPick: () => {} });
    const resetEmpty = !!document.querySelector('[data-p692empty]');
    const resetCards = document.querySelectorAll('[data-p692pick]').length;
    document.querySelector('.p692pick').remove();
    return { withEmpty, resetEmpty, resetCards };
  });
  check('L4/Q4 "Start empty" stands in the Add-seat pick only — absent at Reset; the Reset pick carries the three starters', sheets.withEmpty === true && sheets.resetEmpty === false && sheets.resetCards === 3, sheets);
  const add = await pg.evaluate(() => new Promise((done) => {
    opnMintStarter692('little-way', (mint) => {
      const P = opnDoc().sections.profiles;
      const starter = window.__starter692('little-way');
      const rec = mint ? P.list.filter((p) => p.key === mint.key)[0] : null;
      done({ mint: mint ? { key: mint.key, name: mint.name } : null, standing: P.standingKey,
        coreSame: !!rec && JSON.stringify(rec.coreBlocks) === JSON.stringify(starter.coreBlocks),
        noDefaultKey: !!mint && !['little-way', 'salesian', 'benedictine'].includes(mint.key) });
    });
  }));
  check('L4 Add mints an own profile of the starter\u2019s shape under the starter\u2019s name; no default key is created', !!add.mint && add.mint.name === 'The Little Way' && add.coreSame && add.noDefaultKey, add);
  check('L4/OPEN-4 the standing pick switches to the Add mint', add.standing === (add.mint && add.mint.key), add);
  const empty = await pg.evaluate(() => new Promise((done) => {
    opnMintEmpty692('My Blank', (mint) => {
      const P = opnDoc().sections.profiles;
      const rec = mint ? P.list.filter((p) => p.key === mint.key)[0] : null;
      done({ mint: mint ? { key: mint.key, name: mint.name, kind: mint.kind } : null, core: rec ? rec.coreBlocks : null, contents: rec ? rec.contents : null, standing: P.standingKey });
    });
  }));
  check('L4/Q4 Start empty mints a BLANK own profile (no blocks on, no contents) under the given name', !!empty.mint && empty.mint.name === 'My Blank' && Array.isArray(empty.core) && empty.core.length === 0, empty);
  const door = await pg.evaluate(() => opnLocalApi('/api/prayer/profiles/save', { method: 'PUT', body: JSON.stringify({ name: 'Nope', honorLine: '', coreBlocks: [], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } }) }, 'device')
    .then(() => 'accepted').catch((e) => String(e && e.message || e)));
  check('L4/Q4 the blank mint is a named door only: a plain save with no core blocks still refuses', door.includes('a profile needs at least one core block'), door);
}

// ---------- Rename act (Q2 A) ----------
{
  const r = await pg.evaluate(() => new Promise((done) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1)));
    opnDoc(); // migration runs — Daily stands
    const standingBefore = opnDoc().sections.profiles.standingKey;
    const rec = opnDoc().sections.profiles.list.filter((p) => p.key === 'daily')[0];
    const payload = { key: rec.key, name: 'Daily Rule', honorLine: rec.honorLine || '', coreBlocks: rec.coreBlocks.slice(), layers: opnLayersOut(rec.layers), contents: rec.contents };
    profPut('/api/prayer/profiles/save', payload).then(() => {
      const P = opnDoc().sections.profiles;
      const after = P.list.filter((p) => p.key === 'daily')[0];
      done({ name: after.name, key: after.key, standingSame: P.standingKey === standingBefore });
    }).catch((e) => done({ error: String(e && e.message || e) }));
  }));
  check('Q2 rename in place: the name changes; the KEY and the standing pick stand', r.name === 'Daily Rule' && r.key === 'daily' && r.standingSame === true, r);
}

// ---------- Leg 7 + Q5 A: the toggle ----------
{
  await pg.evaluate(({ TODAY }) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1)));
    opnDoc();
    opn604.res = null;
    state.dayPayload = window.__mkDay692(TODAY);
    state.prayersView = { kind: 'home' };
    opnEnterEdit607();
  }, { TODAY });
  await sleep(1500);
  const head = await pg.evaluate(() => ({
    editing: !!opn604.editing, scope: opn604.scope,
    banner: opnBannerHtml604(), bar: opnEditBarHtml604(),
  }));
  check('L7 the form opens on TODAY scope; the banner carries the segtoggle (Today|Standing), no flip button', head.editing && head.scope === 'today'
    && head.banner.includes('data-p692segtoggle') && head.banner.includes('data-p692scope="today"') && head.banner.includes('data-p692scope="standing"')
    && !head.banner.includes('data-p604change') && head.banner.includes('Editing today only — '), head.banner.slice(0, 200));
  check('L7 no Save today button paints in the bar (either state\u2019s bar is Save New · ⋯ · Done)', !/Save today/.test(head.bar) && head.bar.includes('Save New'), head.bar.slice(0, 200));
  // Per-scope session preservation: arrange in Today (un-written), flip, flip back.
  const sess = await pg.evaluate(async () => {
    opnMaterialize604('Midday').push({ kind: 'prayer', key: 'stations-of-the-cross' });
    const inToday = opn604.lists.Midday.length;
    opnFlipScope609();
    const scopeAfterFlip = opn604.scope;
    const standingLists = Object.keys(opn604.lists).length;
    opnFlipScope609();
    return { inToday, scopeAfterFlip, standingLists, backScope: opn604.scope, restored: (opn604.lists.Midday || []).length, hasStations: (opn604.lists.Midday || []).some((it) => it.key === 'stations-of-the-cross') };
  });
  check('L7/Q5 flipping to Standing starts that scope fresh; the Today session arrangement SURVIVES the round trip', sess.inToday === 3 && sess.scopeAfterFlip === 'standing' && sess.backScope === 'today' && sess.restored === 3 && sess.hasStations === true, sess);
  // Written acts stand in their scope's store.
  const wr = await pg.evaluate(async ({ TODAY }) => {
    await opnWrite604('Midday'); // today-scope write of the arranged list
    const P1 = opnDoc().sections.profiles;
    const layerAfterTodayWrite = JSON.parse(JSON.stringify(P1.todayEdits[TODAY] || null));
    opnFlipScope609(); // standing
    opnMaterialize604('Morning').push({ kind: 'prayer', key: 'angelus-midday' });
    await opnWrite604('Morning'); // standing-scope write
    const P2 = opnDoc().sections.profiles;
    const daily = P2.list.filter((p) => p.key === 'daily')[0];
    return { layerAfterTodayWrite, layerAfterStandingWrite: P2.todayEdits[TODAY] || null, morningLen: (daily.contents.Morning || []).length };
  }, { TODAY });
  check('L7 a today-scope written act lands in the today layer (divergent contents stand)', !!wr.layerAfterTodayWrite && (wr.layerAfterTodayWrite.contents.Midday || []).length === 2 && (wr.layerAfterTodayWrite.contents.Midday || []).some((it) => it.key === 'stations-of-the-cross'), wr.layerAfterTodayWrite);
  check('L7 a standing-scope written act lands in the profile; the today layer stands exactly as it was', wr.morningLen === 10 && JSON.stringify(wr.layerAfterStandingWrite) === JSON.stringify(wr.layerAfterTodayWrite), { morningLen: wr.morningLen });
  const head2 = await pg.evaluate(() => opnBannerHtml604());
  check('L7 the Standing band line names the profile: "Editing standing — in Daily, your every-day profile"', head2.includes('Editing standing — in Daily, your every-day profile'), head2.slice(0, 200));
  await pg.evaluate(() => opnExitEdit607());
}

// ---------- Q9 A: Reset on the Configure surface ----------
{
  await pg.evaluate(({ TODAY }) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.F1)));
    opnDoc();
    openProfilesScreen('daily');
  }, { TODAY });
  await sleep(1500);
  const btn = pg.locator('[data-p593reset]').first();
  check('Q9 the Configure surface carries "Reset this profile…" for the custom Daily', (await btn.textContent() || '').includes('Reset this profile'), await btn.textContent());
  await btn.click(); await sleep(400);
  check('Q9 first tap arms ("Tap again to reset")', (await pg.locator('[data-p593reset]').first().textContent() || '').includes('Tap again to reset'));
  await pg.locator('[data-p593reset]').first().click(); await sleep(500);
  check('Q9 second tap opens the starter pick (three cards, no Start empty)', await pg.evaluate(() => {
    const sh = document.querySelector('.p692pick');
    return !!sh && sh.querySelectorAll('[data-p692pick]').length === 3 && !sh.querySelector('[data-p692empty]');
  }));
  await pg.click('.p692pick [data-p692pick="little-way"]');
  await sleep(1000);
  const r = await pg.evaluate(() => {
    const P = opnDoc().sections.profiles;
    const rec = P.list.filter((p) => p.key === 'daily')[0];
    return { core: rec.coreBlocks, name: rec.name, key: rec.key };
  });
  check('Q9 the Configure Reset replaces the shape with the picked starter; the name + key stand', JSON.stringify(r.core) === JSON.stringify(['Morning', 'Night']) && r.name === 'Daily' && r.key === 'daily', r);
  await pg.evaluate(() => { const sh = document.querySelector('.profplan590'); if (sh) sh.remove(); });
}

// ---------- PHANTOM-EDITS legs (John's exact case) ----------
{
  const r = await pg.evaluate(({ TODAY }) => {
    window.__setDoc692(JSON.parse(JSON.stringify(window.__FIX692.PH)));
    const P = opnDoc().sections.profiles;
    const day = opnScrubDayPayload(window.__mkDay692(TODAY));
    const row = profPlanRowHtml(day);
    return { entry: P.todayEdits[TODAY] || null, foldMark: !!(day.profile && day.profile.todayEdits), row };
  }, { TODAY });
  check('PHANTOM the shape-seeded equal layer is scrubbed at migration: NO today layer stands', r.entry === null, r.entry);
  check('PHANTOM the head line carries NO today note after a standing-only history', r.foldMark === false && !r.row.includes('today has its own edits'), r.row.slice(0, 240));
  const r2 = await pg.evaluate(({ TODAY }) => new Promise((done) => {
    // A today-scope shape write (equal shape) stores nothing.
    const rec = opnDoc().sections.profiles.list[0];
    profPut('/api/prayer/profiles/today-edit', { date: TODAY, layer: { baseProfileKey: 'daily', coreBlocks: rec.coreBlocks.slice(), layers: opnLayersOut(rec.layers) } })
      .then((res) => {
        // Then a STANDING edit only (contents change).
        const payload = { key: rec.key, name: rec.name, honorLine: '', coreBlocks: rec.coreBlocks.slice(), layers: opnLayersOut(rec.layers), contents: JSON.parse(JSON.stringify(rec.contents)) };
        payload.contents.Night = payload.contents.Night.concat([{ kind: 'prayer', key: 'angelus-midday' }]);
        return profPut('/api/prayer/profiles/save', payload).then((res2) => {
          const P = opnDoc().sections.profiles;
          const day = opnScrubDayPayload(window.__mkDay692(TODAY));
          done({ stored: P.todayEdits[TODAY] || null, payloadToday: res.todayEdit, foldMark: !!(day.profile && day.profile.todayEdits) });
        });
      }).catch((e) => done({ error: String(e && e.message || e) }));
  }), { TODAY });
  check('PHANTOM a non-divergent today-edit write stores NOTHING (route guard)', r2.stored === null && r2.payloadToday === null, r2);
  check('PHANTOM after a standing-only edit the fold carries NO today mark', r2.foldMark === false, r2);
  const r3 = await pg.evaluate(({ TODAY }) => new Promise((done) => {
    // A REAL today edit paints; a later standing edit leaves it standing.
    profPut('/api/prayer/profiles/today-edit', { date: TODAY, layer: { baseProfileKey: 'daily', contents: { Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }] } } })
      .then(() => {
        const day1 = opnScrubDayPayload(window.__mkDay692(TODAY));
        const mark1 = !!(day1.profile && day1.profile.todayEdits);
        const midday1 = JSON.stringify((day1.profile.contents || {}).Midday || null);
        const rec = opnDoc().sections.profiles.list[0];
        const payload = { key: rec.key, name: rec.name, honorLine: '', coreBlocks: rec.coreBlocks.slice(), layers: opnLayersOut(rec.layers), contents: JSON.parse(JSON.stringify(rec.contents)) };
        payload.contents.Morning = payload.contents.Morning.slice(0, 3);
        return profPut('/api/prayer/profiles/save', payload).then(() => {
          const day2 = opnScrubDayPayload(window.__mkDay692(TODAY));
          done({ mark1, mark2: !!(day2.profile && day2.profile.todayEdits), middaySame: JSON.stringify((day2.profile.contents || {}).Midday || null) === midday1 });
        });
      }).catch((e) => done({ error: String(e && e.message || e) }));
  }), { TODAY });
  check('PHANTOM a real today edit paints the note; a standing edit after it leaves the note AND today\u2019s composed block unchanged', r3.mark1 === true && r3.mark2 === true && r3.middaySame === true, r3);
}

// ---------- Server legs (extracted real functions) ----------
{
  const indexSrc = readFileSync(path.join(W, 'src/index.ts'), 'utf8');
  function extractFn(s, name) {
    const start = s.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('fn not found: ' + name);
    const nl = s.indexOf('\n', start);
    let i = s.lastIndexOf('{', nl);
    let depth = 0, j = i;
    for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (!depth) break; } }
    return s.slice(start, j + 1);
  }
  let mig = null, div = null, DES = null;
  try {
    let divBody = extractFn(indexSrc, 'todayLayerDiverges594')
      .replace('function todayLayerDiverges594(profile: PrayerProfile, layer: TodayLayer): boolean {', 'function todayLayerDiverges594(profile, layer) {');
    let migBody = extractFn(indexSrc, 'migrateStore692')
      .replace(/function migrateStore692\(store: PrayerProfileStore\): \{[^}]*\} \| null \{/, 'function migrateStore692(store) {')
      .replace('const isWay = (p: PrayerProfile) =>', 'const isWay = (p) =>')
      .replace('const removedKeys: string[] = [];', 'const removedKeys = [];')
      .replace('let copy: PrayerProfile | undefined;', 'let copy;')
      .replace('const todayEdits: Record<string, TodayLayer> = JSON.parse(JSON.stringify(store.todayEdits || {})) as Record<string, TodayLayer>;', 'const todayEdits = JSON.parse(JSON.stringify(store.todayEdits || {}));')
      .replace('copy = JSON.parse(JSON.stringify(standing)) as PrayerProfile;', 'copy = JSON.parse(JSON.stringify(standing));')
      .replace('copy!', 'copy');
    let slugBody = extractFn(indexSrc, 'profileSlug692').replace('function profileSlug692(name: string): string {', 'function profileSlug692(name) {');
    const desMatch = indexSrc.match(/const DESIGNED_PROFILES_591 = (\[[\s\S]*?\n\];)/);
    DES = new Function('return ' + desMatch[1].replace(/ as string\[\]/g, '').replace(/;$/, ''))();
    div = new Function(divBody + '\nreturn todayLayerDiverges594;')();
    mig = new Function('DESIGNED_PROFILES_591', 'todayLayerDiverges594', slugBody + '\n' + migBody + '\nreturn migrateStore692;')(DES, div);
    check('S the real server migrateStore692 + todayLayerDiverges594 extract standalone', typeof mig === 'function' && DES.length === 3);
  } catch (e) { check('S the real server migrateStore692 + todayLayerDiverges594 extract standalone', false, e.message); }
  if (mig) {
    const L = { novenas: { on: true }, podcasts: { on: false, series: [] } };
    const store = {
      profiles: [
        { key: 'little-way', name: 'The Little Way', honorLine: 'h', kind: 'default', coreBlocks: ['Morning', 'Night'], layers: JSON.parse(JSON.stringify(L)) },
        { key: 'salesian', name: 'The Salesian Way', honorLine: 'h', kind: 'default', coreBlocks: ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'], layers: JSON.parse(JSON.stringify(L)), contents: { Night: [{ kind: 'course', key: 'bible-in-a-year' }] } },
        { key: 'benedictine', name: 'The Benedictine Way', honorLine: 'h', kind: 'default', coreBlocks: ['Morning', 'Night'], layers: JSON.parse(JSON.stringify(L)) },
      ],
      standingKey: 'salesian', dayRule: false, version: 3,
      todayEdits: { '2026-11-26': { baseProfileKey: 'salesian', contents: { Midday: [{ kind: 'prayer', key: 'angelus-midday' }] } } },
    };
    const out = mig(JSON.parse(JSON.stringify(store)));
    check('S server migration: the standing Way becomes an own copy (slug + -own, kind custom, startedFrom)', !!out && out.profiles.length === 1 && out.profiles[0].key === 'the-salesian-way-own' && out.profiles[0].kind === 'custom' && out.profiles[0].startedFrom === 'salesian', out && out.profiles);
    check('S server migration: standingKey + today base re-point at the copy; the copy\u2019s shape stands whole', !!out && out.standingKey === 'the-salesian-way-own' && out.todayEdits['2026-11-26'].baseProfileKey === 'the-salesian-way-own' && JSON.stringify(out.profiles[0].coreBlocks) === JSON.stringify(store.profiles[1].coreBlocks), out && out.standingKey);
    check('S server migration is idempotent: a second run answers null', mig(JSON.parse(JSON.stringify({ profiles: out.profiles, standingKey: out.standingKey, dayRule: false, version: 4, todayEdits: out.todayEdits }))) === null);
    const phantom = mig({ profiles: [{ key: 'daily', name: 'Daily', honorLine: '', kind: 'custom', coreBlocks: ['Morning'], layers: JSON.parse(JSON.stringify(L)) }], standingKey: 'daily', dayRule: false, version: 1,
      todayEdits: { '2026-11-26': { baseProfileKey: 'daily', coreBlocks: ['Morning'], layers: JSON.parse(JSON.stringify(L)) } } });
    check('S server scrub: a non-divergent today entry is dropped even with no Way standing', !!phantom && !('2026-11-26' in phantom.todayEdits), phantom);
  }
}

// ---------- Server RESET convergence legs (v692 Review repair) ----------
// The REAL Worker bundle driven through the REAL server
// reset route (PUT /api/prayer/profiles/reset) over a
// fake D1 store — the server-extraction posture of the
// legs above, one level up: the route, prayerProfileStore,
// profilesPayload, profileFoldOf and playerDayPayload all
// run as built. Fixture: one own profile ("daily", custom)
// standing; the source-settings rows are the client's
// 26-row seed (the production shape both sides read).
// The expected contents are computed from that seed by
// the client's standing-list rule (own enabled rows, then
// external enabled non-fallback rows, sortOrder-merged).
{
  const standingList = (block) => {
    const merged = [];
    SEED.forEach((r) => { if (r.family === 'own' && r.enabled === 1 && r.block === block) merged.push({ kind: 'source', key: r.sourceKey, so: r.sortOrder }); });
    SEED.forEach((r) => { if (r.family === 'external' && r.enabled === 1 && r.role !== 'fallback' && r.slotId && r.block === block) merged.push({ kind: 'source', key: r.slotId, so: r.sortOrder }); });
    merged.sort((a, b2) => (a.so == null ? 1e9 : a.so) - (b2.so == null ? 1e9 : b2.so));
    return merged.map((m) => ({ kind: m.kind, key: m.key }));
  };
  const expectedContents = {
    Morning: standingList('Morning').concat([{ kind: 'seat', key: 'daily-readings' }]),
    Night: standingList('Night').concat([{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'course', key: 'exorcist-files' }]),
  };
  // The payload/fold read passes contents through the
  // standing validator (validateProfileContents686 at
  // prayerProfileStore), which stamps side:'sth' on the
  // labeled office slots (the v670 mirror rule) — the
  // payload-level expectation carries that normalization;
  // the STORED layers JSON is asserted raw, above it.
  const expectedPayloadContents = JSON.parse(JSON.stringify(expectedContents));
  for (const items of Object.values(expectedPayloadContents)) for (const it of items) {
    if (it.kind === 'source' && (it.key === 'ext-morning-prayer' || it.key === 'ext-evening-prayer')) it.side = 'sth';
  }
  const srvState = {
    profiles: [{ key: 'daily', name: 'Daily', honorLine: '', kind: 'custom', coreBlocks: ['Morning', 'Night'], storedLayers: { novenas: { on: 0 }, podcasts: { on: 0, series: [] } } }],
    standingKey: 'daily', version: 3, todayEdits: {},
  };
  const mkStmt = (first, all, apply) => {
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() { return first ? first(args) : null; },
      async all() { return { results: all ? all(args) : [] }; },
      async run() { if (apply) apply(args); return {}; },
      _apply() { if (apply) apply(args); },
    };
    return stmt;
  };
  const fakeDB = {
    prepare(sql) {
      if (sql.includes('SELECT today_edits')) return mkStmt(() => ({ today_edits: JSON.stringify(srvState.todayEdits) }));
      if (sql.includes('FROM prayer_profiles') && sql.includes('ORDER BY sort_order')) return mkStmt(null, () => srvState.profiles.map((p) => ({ key: p.key, name: p.name, honor_line: p.honorLine, kind: p.kind, core_blocks: JSON.stringify(p.coreBlocks), layers: JSON.stringify(p.storedLayers) })));
      if (sql.includes('SELECT standing_key')) return mkStmt(() => ({ standing_key: srvState.standingKey, day_rule: 0, version: srvState.version }));
      if (sql.includes('FROM player_settings_meta')) return mkStmt(() => ({ version: 1 }));
      if (sql.includes('FROM player_source_settings')) return mkStmt(null, () => SEED.map((r) => ({ source_key: r.sourceKey, name: r.name, family: r.family, block: r.block, day_rule: r.dayRule, sort_order: r.sortOrder, enabled: r.enabled, slot_id: r.slotId, role: r.role })));
      if (sql.includes('UPDATE prayer_profiles SET core_blocks')) return mkStmt(null, null, (a) => { const p = srvState.profiles.find((x) => x.key === a[3]); p.coreBlocks = JSON.parse(a[0]); p.storedLayers = JSON.parse(a[1]); });
      if (sql.includes('UPDATE prayer_profile_state SET version')) return mkStmt(null, null, () => { srvState.version++; });
      return mkStmt(null, null, null);
    },
    async batch(stmts) { for (const s of stmts) if (s._apply) s._apply(); return []; },
  };
  const srvEnv = { DB: fakeDB, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
  try {
    const resetRes = await WORKER.fetch(new Request('https://app.local/api/prayer/profiles/reset', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileKey: 'daily', starterKey: 'salesian' }),
    }), srvEnv);
    const resetBody = await resetRes.json();
    const rec = (resetBody.profiles || []).find((p) => p.key === 'daily') || null;
    check('SR server reset (Salesian): the route answers with the reset profile standing', resetRes.status === 200 && !!rec, { status: resetRes.status, body: JSON.stringify(resetBody).slice(0, 200) });
    check('SR the payload record carries contents — Morning standing list + the readings seat; Night standing list + bible-in-a-year/exorcist-files course items (the client reset shape, at the standing read normalization)',
      !!rec && JSON.stringify(rec.contents || null) === JSON.stringify(expectedPayloadContents), rec && rec.contents);
    check('SR the payload record shows layers.podcasts {on:false, series:[]} and novenas on (as seeded) — the Edit form\u2019s read converges with the client reset',
      !!rec && rec.layers.podcasts.on === false && (rec.layers.podcasts.series || []).length === 0 && rec.layers.novenas.on === true, rec && rec.layers);
    check('SR the stored layers JSON itself carries the migrated shape (contents ride it; podcasts off/empty in the store, not only in the payload)',
      srvState.profiles[0].storedLayers.podcasts.on === 0 && (srvState.profiles[0].storedLayers.podcasts.series || []).length === 0
      && JSON.stringify(srvState.profiles[0].storedLayers.contents || null) === JSON.stringify(expectedContents), srvState.profiles[0].storedLayers);
    check('SR reset preserves key, name and the standing pick; coreBlocks are the starter\u2019s',
      !!rec && rec.key === 'daily' && rec.name === 'Daily' && resetBody.state && resetBody.state.standingKey === 'daily'
      && JSON.stringify(rec.coreBlocks) === JSON.stringify(['Morning', 'Midday', 'Evening', 'Night']), rec && { core: rec.coreBlocks, state: resetBody.state });
    check('SR the effective fold converges: contents stand (not null), podcasts layer off/empty',
      !!resetBody.effective && JSON.stringify(resetBody.effective.contents || null) === JSON.stringify(expectedPayloadContents)
      && resetBody.effective.layers.some((l) => l.key === 'podcasts' && l.on === false && (l.series || []).length === 0), resetBody.effective && resetBody.effective.layers);
    const dayRes = await WORKER.fetch(new Request('https://app.local/api/player/day'), srvEnv);
    const day = await dayRes.json();
    const dayBlocks = (day.blocks || []).map((x) => x.block);
    check('SR the server-composed day carries NO Podcasts layer block and carries the Novenas layer block',
      dayRes.status === 200 && !dayBlocks.includes('Podcasts') && dayBlocks.includes('Novenas'), dayBlocks);
    check('SR the server-composed day\u2019s fold carries the two course items in Night contents',
      !!day.profile && ((day.profile.contents || {}).Night || []).filter((it) => it.kind === 'course').map((it) => it.key).join(',') === 'bible-in-a-year,exorcist-files',
      day.profile && day.profile.contents);
  } catch (e) { check('SR server reset convergence legs run', false, String(e && e.message || e).slice(0, 300)); }
}

await pg.close();

// ---------- WEB leg (Mode 3, plain tab) ----------
const pgw = await b.newPage({ viewport: { width: 390, height: 844 } });
pgw.on('pageerror', (e) => console.log('PAGEERROR(web) ' + String(e).slice(0, 200)));
await pgw.addInitScript(({ SEED, TODAY }) => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  window.__mkDay692 = (date) => ({
    ok: true, date, presentedDay: date, dateLabel: date,
    blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
    additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
  });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay692(m ? m[1] : TODAY)); }
    if (u.includes('/api/player/source-settings')) return resp({ ok: true, version: 1, sources: clone(SEED) });
    if (u.includes('/api/prayer/book')) return resp({ ok: true, groups: [] });
    if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
    if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
    return new Promise(() => {});
  };
}, { SEED, TODAY });
await pgw.goto('http://127.0.0.1:' + PORT + '/');
await pgw.waitForTimeout(1600);
{
  const mode = await pgw.evaluate(() => opnMode());
  check('W web mode stands in a plain tab (Mode 3)', mode === 'web', mode);
  await pgw.evaluate(() => opnEnsureStandings601());
  const html = await pgw.evaluate(() => opnWebBenedictineHtml692());
  const blocks = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  // v698 re-point: the honor line is removed from the web display (Plan §2.5) — assert its ABSENCE instead of its presence; every other assertion word-identical.
  check('W the web paint path carries the FULL Benedictine shape — every block stands with its contents',
    !!html && blocks.every((bl) => html.includes('<h4>' + bl + '</h4>')) && (html.match(/<li>/g) || []).length >= 6 && html.includes('The Benedictine Way') && !html.includes('named in honor of the tradition'), (html || '').slice(0, 300));
  check('W the Morning block carries the readings seat (the post-mig609 contents)', !!html && html.includes('readings'), (html || '').slice(0, 400));
  check('W the web surface offers NO pick and the starter offer does NOT stand', !!html && !html.includes('data-p692pick') && !html.includes('data-p692starter')
    && await pgw.evaluate(() => opnStarterOfferStands692()) === false);
  check('W nothing is stored on the web surface', await pgw.evaluate(() => localStorage.getItem('opn-personal-data-v1')) === null);
  const homeHtml = await pgw.evaluate(({ TODAY }) => {
    state.dayPayload = window.__mkDay692(TODAY);
    state.prayersView = { kind: 'home' };
    paintPrayersView(state.dayPayload);
    return document.body.innerHTML;
  }, { TODAY });
  check('W the painted web home stands the Benedictine card and no starter offer', homeHtml.includes('data-p692webben="1"') && !homeHtml.includes('data-p692offer'));
}
await pgw.close();

await b.close();
server.close();
console.log('\nharness-v692: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
