// harness-v517.mjs — v517 evidence: Prayer Profiles II
// (customize-and-save: the profile editor, save-as-new,
// save-over a custom, delete a custom with the fallback
// rule, the three defaults read-only, and the profile
// card collapsed by default). Built to the v517 release
// document §2, whose design authority is the v514 Plan
// (P1/P7/P8).
//   S statics: no migration beyond 0038 · index.ts carries
//     the save + delete routes, validateProfileLayers used
//     by both write routes, the defaults refusals, the
//     picks cleanup + standing reset · client.ts carries
//     profCardOpen (false at boot), the expand/customize/
//     edit wiring, openProfileEditor · the Mass sources
//     byte-identical to the base · ui.ts byte-identical to
//     the base outside the pin (no ui.ts rule was added —
//     the standing global input[type=text] rule and the
//     .f label carry the editor's inputs) · the fixtures
//     stand
//   M migration: the real 0038 in sqlite — the three
//     tables' column lists exactly as at v515 (the
//     no-migration proof)
//   W worker (local wrangler + fixture D1): D1 through
//     0038, then the live store shape applied as SQL (the
//     salesian podcasts layer on [bible-in-a-year,
//     exorcist-files], state version 4) · the profiles read
//     matches the live shape · save-as-new creates a kind
//     'custom' profile sorted after the defaults, the
//     version +1, and a day-pick of it composes the day ·
//     save-over renames + reorders · a default key refuses
//     save and delete with the store byte-unchanged · the
//     validation negatives are named 400s, the version
//     unmoved · delete of the ACTIVE custom (standing +
//     a pick naming it) clears the picks, resets the
//     standing default to salesian, and bumps the version
//     exactly once · the layers PUT on a fresh custom still
//     writes through the refactored validator · the
//     untouched folds read back identical
//   C client (the v510 Chromium mold, stubbed fetch; the
//     stub store mirrors the shipped server contract incl.
//     save/delete): a cold open paints the card COLLAPSED ·
//     expand paints the standing acts + Customize · the
//     Novenas toggle from the expanded card removes and
//     restores the group whole · collapse hides the acts ·
//     the Change sheet's rows carry Edit acts and Edit on
//     The Salesian Way opens the editor in copy mode ·
//     editor acts + Save-as-new gain the custom, the sheet
//     lists it, picking it rebuilds the day to its shape ·
//     Save-over on the custom reorders its day · Delete
//     (arm + tap) removes the custom and the day falls
//     back to the standing default · a played mark stands
//     after a switch to the custom and back · the cooked
//     parse + Chromium boot clean · a non-pilot prayer page
//     byte-identical to the base ship's
// Fixtures (Improvement D), under tests/fixtures-v517/,
// drawn from production on 2026-11-17 through the prayer
// door AFTER v520 shipped: (a) the live profiles read
// (the three defaults with the salesian podcasts layer ON
// [bible-in-a-year, exorcist-files] — John's own v515
// acts — state v4, no picks); (b) the live day payload;
// (c) the live series index (currents biy:day-318 ·
// ciy:day-2, re-read at fixture draw). The two series
// payloads are fixtures-v515's, reused because their
// currentKey still matches the live index currents
// (verified at fixture draw). (e) the standing book
// fixture (tests/fixtures/book-live-2026-11-17.json).
// The base for byte comparisons is the v520 ship tree
// (H517_BASE overrides).
// NOTE (deviation from the brief's W wording, grounded in
// §2/P3): after the active custom's delete, the brief
// glosses ?date=2026-11-22 as resolving salesian/standing;
// 2026-11-22 is a Sunday, so with the pick gone the day
// rule carries it to benedictine by 'rule' — the harness
// asserts exactly that (the pick is gone, the fold never
// names the deleted profile), and asserts the presented
// (weekday) day resolves salesian by 'standing', as §2's
// own W leg states.
// Run: node app/tests/harness-v517.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MIG38 = readFileSync(APP + '/migrations/0038_prayer_profiles.sql', 'utf8');
const BASE = process.env.H517_BASE || path.resolve(ROOT, '../../.worktrees/v520-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v517';
const FX515 = APP + '/tests/fixtures-v515';
const PROFILES_LIVE = JSON.parse(readFileSync(FX + '/profiles-live-2026-11-17.json', 'utf8'));
const DAY_LIVE = JSON.parse(readFileSync(FX + '/day-live-2026-11-17.json', 'utf8'));
const PODINDEX = JSON.parse(readFileSync(FX + '/podindex-live-2026-11-17.json', 'utf8'));
const BIY = JSON.parse(readFileSync(FX515 + '/series-bible-in-a-year-live-2026-11-17.json', 'utf8'));
const CIY = JSON.parse(readFileSync(FX515 + '/series-catechism-in-a-year-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const pp = {}; parts.forEach((x) => { pp[x.type] = x.value; });
const TODAY = pp.year + '-' + pp.month + '-' + pp.day;
const DATE_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const HONOR = "named in honor of the tradition, not the order's own routine";
const VALID_LAYERS = { novenas: { on: true }, podcasts: { on: false, series: [] } };

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0038_prayer_profiles.sql' && !migs.some((m) => m.startsWith('0039')),
    'S1: no migration file beyond 0038 stands in app/migrations (0038 is the newest)', migs[migs.length - 1]);
  ok(I_SRC.includes('function validateProfileLayers(')
    && (I_SRC.match(/validateProfileLayers\(/g) || []).length >= 3
    && I_SRC.includes('seg[3] === "save" && request.method === "PUT"')
    && I_SRC.includes('seg[3] === "delete" && request.method === "PUT"')
    && I_SRC.includes('seg[3] === "layers" && request.method === "PUT"'),
    'S2: index.ts carries validateProfileLayers (defined once, used by the layers and save routes) and the save + delete routes');
  ok(I_SRC.includes('the named profiles cannot be changed — save as new')
    && I_SRC.includes('the named profiles cannot be deleted')
    && I_SRC.includes('DELETE FROM prayer_profile_day_picks WHERE profile_key = ?')
    && I_SRC.includes("standing_key = 'salesian'")
    && I_SRC.includes('"name required"') && I_SRC.includes('"name too long"') && I_SRC.includes('"honor line too long"')
    && I_SRC.includes('"coreBlocks must be an array"') && I_SRC.includes('is a layer, not a core block')
    && I_SRC.includes('"a profile needs at least one core block"'),
    'S3: index.ts carries the two defaults refusals, the picks cleanup, the standing reset, and the save route\'s named validations');
  ok(C_SRC.includes('var profCardOpen = false;') && C_SRC.includes('data-profexpand') && C_SRC.includes('data-profcustomize')
    && C_SRC.includes('data-profedit') && C_SRC.includes('function openProfileEditor(')
    && C_SRC.includes('data-edup') && C_SRC.includes('data-eddown') && C_SRC.includes('data-edoff') && C_SRC.includes('data-edon')
    && C_SRC.includes('data-edlayer') && C_SRC.includes('data-edseries') && C_SRC.includes('data-edsave') && C_SRC.includes('data-eddelete')
    && C_SRC.includes("'/api/prayer/profiles/save'") && C_SRC.includes("'/api/prayer/profiles/delete'"),
    'S4: client.ts carries profCardOpen starting false, the expand/customize/edit wiring, and openProfileEditor with its data-ed* acts');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S5-' + f + ': the Mass source stands byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE),
    'S6: ui.ts is byte-identical to the base ship outside the pin (no ui.ts rule added in v517)');
  const byKey = {}; (PROFILES_LIVE.profiles || []).forEach((p) => { byKey[p.key] = p; });
  ok(['little-way', 'salesian', 'benedictine'].every((k) => byKey[k] && byKey[k].kind === 'default')
    && byKey['salesian'].layers.podcasts.on === true
    && JSON.stringify(byKey['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files"]'
    && PROFILES_LIVE.state && PROFILES_LIVE.state.version === 4 && PROFILES_LIVE.state.standingKey === 'salesian',
    'S7: the profiles fixture stands (the three defaults, the salesian podcasts layer on [bible-in-a-year, exorcist-files], state version 4)');
  const idxByKey = {}; (PODINDEX.seriesList || []).forEach((s) => { idxByKey[s.series] = s; });
  ok(idxByKey['bible-in-a-year'] && idxByKey['bible-in-a-year'].currentKey === 'biy:day-318'
    && idxByKey['catechism-in-a-year'] && idxByKey['catechism-in-a-year'].currentKey === 'ciy:day-2'
    && BIY.currentKey === 'biy:day-318' && CIY.currentKey === 'ciy:day-2',
    'S8: the series fixtures stand (the live index currents biy:day-318 · ciy:day-2 match the reused v515 series payloads)');
  ok(DAY_LIVE.profile && DAY_LIVE.profile.key === 'salesian' && DAY_LIVE.version === 8,
    'S9: the live day fixture stands (the presented day resolved to the salesian fold, settings v8)');
}

/* ---------------- M: the no-migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys, json',
    'mig = open(sys.argv[1]).read()',
    'db = sqlite3.connect(":memory:")',
    'db.executescript(mig)',
    'cols = {t: [r[1] for r in db.execute(f"PRAGMA table_info({t})").fetchall()] for t in ("prayer_profiles","prayer_profile_state","prayer_profile_day_picks")}',
    'assert cols["prayer_profiles"] == ["key","name","honor_line","kind","core_blocks","layers","sort_order","updated_at"], cols["prayer_profiles"]',
    'assert cols["prayer_profile_state"] == ["id","standing_key","day_rule","version","updated_at"], cols["prayer_profile_state"]',
    'assert cols["prayer_profile_day_picks"] == ["date","profile_key","updated_at"], cols["prayer_profile_day_picks"]',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v517-mig.py');
  fs.writeFileSync(tmp, py);
  const f38 = path.join(os.tmpdir(), 'harness-v517-0038.sql');
  fs.writeFileSync(f38, MIG38);
  let migOut = '';
  try { migOut = execFileSync('python3', [tmp, f38], { encoding: 'utf8' }); }
  catch (e) { migOut = 'ERR ' + String(e.stdout || e.message).slice(0, 240); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real 0038 applies clean and the three tables\' column lists stand exactly as at v515 — v517 adds no table and no column',
    migOut.trim().slice(0, 200));
}

/* ---------------- W: the worker round-trip ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PERSIST = path.join(APP, '.wrangler-test-v517');
const WPORT = 8799;
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-v517-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h517-'));
function wranglerD1(args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(APP, 'wrangler.toml'), '--persist-to', PERSIST, ...args],
    { cwd: APP, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function wranglerD1File(file) { return wranglerD1(['--file', file]); }
function migFiles() {
  const dir = path.join(APP, 'migrations');
  return readdirSync(dir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(dir, f));
}
function applyFiles(files) {
  rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, 'mig-joined.sql');
  fs.writeFileSync(f, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1File(f);
}
function applySql(sql) {
  const f = path.join(TMPD, 'one-' + Math.random().toString(36).slice(2, 8) + '.sql');
  fs.writeFileSync(f, sql);
  wranglerD1File(f);
}
function d1q(sql) {
  const out = wranglerD1(['--json', '--command', sql]);
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results || [];
}
const procs = [];
function startApp() {
  const args = ['dev', '--config', path.join(APP, 'wrangler.toml'), '--local', '--port', String(WPORT), '--persist-to', PERSIST,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(WBASE + '/'); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const AGENT = { authorization: 'Bearer ' + TOKEN };
const wget = async (p, headers) => { const r = await fetch(WBASE + p, { headers: headers || {} }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const wput = async (p, body) => {
  const r = await fetch(WBASE + p, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const doorDay = () => wget('/api/agent/player/day', AGENT);
const doorProfiles = (date) => wget('/api/agent/prayer/profiles' + (date ? '?date=' + date : ''), AGENT);
const blockNames = (day) => (day.blocks || []).map((b) => b.block);
const byKeyOf = (b) => { const m = {}; (b.profiles || []).forEach((p) => { m[p.key] = p; }); return m; };

if (!PROBE) {
  try {
    applyFiles(migFiles());
    startApp();
    ok(await waitUp(), 'W0: app up on local wrangler (LOCAL_DEV harness mode), D1 through 0038');
    // The live store shape applied as SQL (the fixture
    // draw): the salesian podcasts layer on with John's two
    // series, the state version at 4.
    applySql(`UPDATE prayer_profiles SET layers = '{"novenas":{"on":1},"podcasts":{"on":1,"series":["bible-in-a-year","exorcist-files"]}}' WHERE key = 'salesian';
UPDATE prayer_profile_state SET version = 4 WHERE id = 1;`);
    let expectedVersion = 4;
    {
      const prof = (await doorProfiles()).body;
      ok(JSON.stringify(prof.profiles) === JSON.stringify(PROFILES_LIVE.profiles)
        && JSON.stringify(prof.state) === JSON.stringify(PROFILES_LIVE.state),
        'W1: the profiles read matches the live shape (the three defaults, the salesian podcasts layer on, state v4)',
        JSON.stringify(prof.state));
    }
    /* the untouched folds, seeded before the writes */
    applySql(`INSERT INTO day_positions (date, episode_id, position_s, duration_s, updated_at) VALUES ('${TODAY}', 'morning-prayer', 42, 720, '2026-11-17T00:00:00.000Z');
INSERT INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES ('bible-in-a-year', 'biy:day-1', '2026-11-12T18:00:00.000Z', '${TODAY}', 'manual');
INSERT INTO prayer_day_additions (date, block, slug, lang, after_id, seq, created_at) VALUES ('${TODAY}', 'Evening', 'te-deum', 'en', NULL, 0, '2026-11-17T00:00:00.000Z');`);
    const posBefore = JSON.stringify(d1q("SELECT date, episode_id, position_s, duration_s FROM day_positions WHERE episode_id = 'morning-prayer'"));
    const listenBefore = JSON.stringify(d1q("SELECT series, seq_key, listened_at, listen_date, source FROM podcast_listens WHERE series = 'bible-in-a-year'"));
    const addBefore = JSON.stringify(d1q("SELECT date, block, slug, lang, after_id, seq FROM prayer_day_additions WHERE slug = 'te-deum'"));
    /* save-as-new */
    let customKey = null;
    {
      const r = await wput('/api/prayer/profiles/save', { name: 'Evening Lite', coreBlocks: ['Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } });
      expectedVersion++;
      const profs = r.body.profiles || [];
      const rec = profs[profs.length - 1];
      customKey = rec && rec.key;
      ok(r.status === 200 && rec && rec.name === 'Evening Lite' && rec.kind === 'custom' && customKey === 'evening-lite'
        && JSON.stringify(rec.coreBlocks) === '["Evening","Night"]' && rec.layers.novenas.on === true && rec.layers.podcasts.on === false
        && profs[profs.length - 2] && profs[profs.length - 2].key === 'benedictine'
        && r.body.state && r.body.state.version === expectedVersion,
        'W2: save-as-new — 200, the new profile stands kind custom with the generated key, sorted after benedictine, version 5',
        JSON.stringify(rec) + ' v=' + (r.body.state && r.body.state.version));
      const pick = await wput('/api/prayer/profiles/day-pick', { date: TODAY, profileKey: customKey });
      expectedVersion++;
      const day = (await doorDay()).body;
      ok(pick.status === 200 && day.profile && day.profile.key === customKey && day.profile.resolvedBy === 'pick'
        && JSON.stringify(blockNames(day)) === '["Evening","Night","Novenas"]',
        'W3: a day-pick of the custom composes the presented day [Evening, Night, Novenas] and the fold names the generated key',
        JSON.stringify(blockNames(day)) + ' ' + JSON.stringify(day.profile && day.profile.key));
    }
    /* save-over */
    {
      const r = await wput('/api/prayer/profiles/save', { key: customKey, name: 'Evening Lite II', coreBlocks: ['Night', 'Evening'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } });
      expectedVersion++;
      const rec = byKeyOf(r.body)[customKey];
      ok(r.status === 200 && rec && rec.name === 'Evening Lite II' && JSON.stringify(rec.coreBlocks) === '["Night","Evening"]'
        && r.body.state && r.body.state.version === expectedVersion,
        'W4: save-over — the read shows the new name and the reordered core, the version +1, the key unchanged',
        JSON.stringify(rec));
    }
    /* the defaults refuse, byte-unchanged */
    {
      const before = JSON.stringify((await doorProfiles()).body);
      const rs = await wput('/api/prayer/profiles/save', { key: 'salesian', name: 'Renamed', coreBlocks: ['Morning'], layers: VALID_LAYERS });
      const afterSave = JSON.stringify((await doorProfiles()).body);
      ok(rs.status === 400 && rs.body.error === 'the named profiles cannot be changed — save as new' && afterSave === before,
        'W5: a save naming a default key is the named 400 and the store + version read byte-unchanged', JSON.stringify(rs.body));
      const rd = await wput('/api/prayer/profiles/delete', { profileKey: 'benedictine' });
      const afterDel = JSON.stringify((await doorProfiles()).body);
      ok(rd.status === 400 && rd.body.error === 'the named profiles cannot be deleted' && afterDel === before,
        'W6: a delete naming a default key is the named 400 and the store + version read byte-unchanged', JSON.stringify(rd.body));
    }
    /* the validation negatives */
    {
      const v0 = (await doorProfiles()).body.state.version;
      const negs = [
        ['empty name', { name: '   ', coreBlocks: ['Morning'], layers: VALID_LAYERS }, 'name required'],
        ['81-char name', { name: 'x'.repeat(81), coreBlocks: ['Morning'], layers: VALID_LAYERS }, 'name too long'],
        ['161-char honor line', { name: 'Ok Name', honorLine: 'y'.repeat(161), coreBlocks: ['Morning'], layers: VALID_LAYERS }, 'honor line too long'],
        ['empty core', { name: 'Ok Name', coreBlocks: [], layers: VALID_LAYERS }, 'a profile needs at least one core block'],
        ['Novenas in core', { name: 'Ok Name', coreBlocks: ['Novenas'], layers: VALID_LAYERS }, 'Novenas is a layer, not a core block'],
        ['Podcasts in core', { name: 'Ok Name', coreBlocks: ['Podcasts'], layers: VALID_LAYERS }, 'Podcasts is a layer, not a core block'],
        ['unknown block', { name: 'Ok Name', coreBlocks: ['Brunch'], layers: VALID_LAYERS }, 'bad block Brunch'],
        ['coreBlocks not an array', { name: 'Ok Name', coreBlocks: 'Morning', layers: VALID_LAYERS }, 'coreBlocks must be an array'],
        ['bad series', { name: 'Ok Name', coreBlocks: ['Morning'], layers: { novenas: { on: true }, podcasts: { on: false, series: ['nope'] } } }, 'bad series nope'],
        ['layers missing podcasts', { name: 'Ok Name', coreBlocks: ['Morning'], layers: { novenas: { on: true } } }, 'layers.podcasts required'],
        ['save with an unknown key', { key: 'nope', name: 'Ok Name', coreBlocks: ['Morning'], layers: VALID_LAYERS }, 'bad profile nope'],
      ];
      let allOk = true; const detail = [];
      for (const [label, body, want] of negs) {
        const r = await wput('/api/prayer/profiles/save', body);
        const good = r.status === 400 && r.body.error === want;
        if (!good) { allOk = false; detail.push(label + ' -> ' + r.status + ' ' + JSON.stringify(r.body)); }
      }
      const rd = await wput('/api/prayer/profiles/delete', { profileKey: 'nope' });
      if (!(rd.status === 400 && rd.body.error === 'bad profile nope')) { allOk = false; detail.push('delete unknown -> ' + rd.status + ' ' + JSON.stringify(rd.body)); }
      const v1 = (await doorProfiles()).body.state.version;
      ok(allOk && v1 === v0,
        'W7: the validation negatives (empty name · 81-char name · long honor line · empty core · Novenas/Podcasts in core · unknown block · non-array core · bad series · layers leg missing · unknown key on save and delete) are named 400s and the version does not move',
        detail.join(' ; ') + ' v ' + v0 + '->' + v1);
    }
    /* delete of the ACTIVE custom */
    {
      const rs = await wput('/api/prayer/profiles/state', { standingKey: customKey });
      expectedVersion++;
      const rp = await wput('/api/prayer/profiles/day-pick', { date: '2026-11-22', profileKey: customKey });
      expectedVersion++;
      ok(rs.status === 200 && rp.status === 200 && rs.body.state.version === expectedVersion - 1 && rp.body.state.version === expectedVersion,
        'W8: the custom stands as the standing default and holds a pick for 2026-11-22 before the delete',
        'v=' + expectedVersion);
      const rd = await wput('/api/prayer/profiles/delete', { profileKey: customKey });
      expectedVersion++;
      const read = rd.body;
      const sun = (await doorProfiles('2026-11-22')).body.effective;
      const day = (await doorDay()).body;
      const picksLeft = d1q("SELECT COUNT(*) AS n FROM prayer_profile_day_picks WHERE profile_key = 'evening-lite'");
      ok(rd.status === 200 && !byKeyOf(read)[customKey] && read.state.standingKey === 'salesian'
        && read.state.version === expectedVersion
        && picksLeft.length && picksLeft[0].n === 0
        && sun && sun.key === 'benedictine' && sun.resolvedBy === 'rule'
        && day.profile && day.profile.key === 'salesian' && day.profile.resolvedBy === 'standing',
        'W9: delete of the active custom — the row and its picks are gone, the standing default reads salesian, the version bumped exactly once; 2026-11-22 (a Sunday) falls to the day rule (benedictine) and the presented day resolves salesian by standing',
        JSON.stringify(read.state) + ' sun=' + JSON.stringify(sun) + ' day=' + JSON.stringify(day.profile));
    }
    /* the layers PUT on a fresh custom, through the refactored validator */
    {
      const rc = await wput('/api/prayer/profiles/save', { name: 'Layer Test', coreBlocks: ['Morning'], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } });
      expectedVersion++;
      const rl = await wput('/api/prayer/profiles/layers', { profileKey: 'layer-test', layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } });
      expectedVersion++;
      const rec = byKeyOf(rl.body)['layer-test'];
      ok(rc.status === 200 && rl.status === 200 && rec && rec.layers.novenas.on === true && rl.body.state.version === expectedVersion,
        'W10: the layers act on a fresh custom still writes through the refactored validator (novenas flipped, version +1)',
        JSON.stringify(rec));
    }
    /* the untouched folds */
    {
      const posAfter = JSON.stringify(d1q("SELECT date, episode_id, position_s, duration_s FROM day_positions WHERE episode_id = 'morning-prayer'"));
      const listenAfter = JSON.stringify(d1q("SELECT series, seq_key, listened_at, listen_date, source FROM podcast_listens WHERE series = 'bible-in-a-year'"));
      const addAfter = JSON.stringify(d1q("SELECT date, block, slug, lang, after_id, seq FROM prayer_day_additions WHERE slug = 'te-deum'"));
      ok(posAfter === posBefore && listenAfter === listenBefore && addAfter === addBefore,
        'W11: the untouched folds (a day position · a podcast listen · a day addition) read back identical after every save and the delete',
        posAfter + ' / ' + listenAfter + ' / ' + addAfter);
    }
  } catch (e) {
    ok(false, 'W: the worker round-trip ran', String(e).slice(0, 240));
  } finally {
    procs.forEach((p) => { try { p.kill('SIGKILL'); } catch { /* gone */ } });
  }
}

/* ---------------- C: the client legs ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
const APP_JS = cook(C_SRC);
const APP_JS_BASE = cook(C_BASE);
try { new Function(APP_JS); ok(true, 'C0: the cooked APP_JS parses whole'); }
catch (e) { ok(false, 'C0: the cooked APP_JS parses whole', String(e).slice(0, 120)); }

const TRACKS = {
  Morning: [{ episodeId: 'morning-prayer', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/morning.mp3' },
            { episodeId: 'daily-rosary', title: 'The Holy Rosary', durationS: 1500, available: true, streamUrl: 'https://audio.example/rosary.mp3' }],
  Midmorning: [{ episodeId: 'midmorning-prayer', title: 'Midmorning Prayer', durationS: 600, available: true, streamUrl: 'https://audio.example/midmorning.mp3' }],
  Midday: [{ episodeId: 'midday-prayer', title: 'Midday Prayer', durationS: 480, available: true, streamUrl: 'https://audio.example/midday.mp3' }],
  Afternoon: [{ episodeId: 'afternoon-prayer', title: 'Afternoon Prayer', durationS: 540, available: true, streamUrl: 'https://audio.example/afternoon.mp3' }],
  Evening: [{ episodeId: 'evening-prayer', title: 'Evening Prayer', durationS: 660, available: true, streamUrl: 'https://audio.example/evening.mp3' }],
  Night: [{ episodeId: 'night-prayer', title: 'Night Prayer', durationS: 420, available: true, streamUrl: 'https://audio.example/night.mp3' }],
  Novenas: [{ episodeId: 'novena-st_catherine_of_alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 2', durationS: 248, available: true, streamUrl: 'https://audio.example/novena-cat.mp3' },
            { episodeId: 'novena-st_monica', title: 'Traditional Novena to St Monica Day 4', durationS: 260, available: true, streamUrl: 'https://audio.example/novena-mon.mp3' }],
};
const CAPTIONS = { Novenas: "the day's novenas", Morning: 'morning prayer and devotions', Midmorning: 'midmorning prayer', Midday: 'the Angelus and midday prayer', Afternoon: 'the Divine Mercy chaplet and afternoon prayer', Evening: 'evening prayer', Night: 'night prayer and an examination' };
function mkBlockStub(name, layer) {
  const b = { block: name, label: name, caption: CAPTIONS[name] || '', spotifyUrl: null, tracks: TRACKS[name] || [], trackCount: (TRACKS[name] || []).length };
  if (layer) b.layer = layer;
  return b;
}
function foldOf(p, resolvedBy, version) {
  return { key: p.key, name: p.name, honorLine: p.honorLine, resolvedBy: resolvedBy, dayKind: 'weekday',
    coreBlocks: p.coreBlocks.slice(),
    layers: [{ key: 'novenas', on: p.layers.novenas.on }, { key: 'podcasts', on: p.layers.podcasts.on, series: p.layers.podcasts.series.slice() }],
    version: version };
}
function freshStore() {
  return {
    profiles: [
      { key: 'little-way', name: 'The Little Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Night'], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } },
      { key: 'salesian', name: 'The Salesian Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year', 'catechism-in-a-year'] } } },
      { key: 'benedictine', name: 'The Benedictine Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } },
    ],
    state: { standingKey: 'salesian', dayRule: true, version: 4 },
    pick: null,
  };
}
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SHELL_BASE = U_BASE.slice(U_BASE.indexOf('SHELL_HTML = `') + 14, U_BASE.indexOf('`;', U_BASE.indexOf('SHELL_HTML = `')));
const MASS_PAYLOAD = { ok: true, date: TODAY, mass: { name: 'Tuesday of week 33 in Ordinary Time', rank: 'ferial', season: 'Ordinary Time', color: 'green', readings: [{ label: 'First Reading', cite: '2 Mc 6:18-31', text: 'Eleazar, one of the foremost scribes.' }, { label: 'Gospel', cite: 'Lk 19:1-10', text: 'Jesus came to Jericho.' }] } };
const MASS_FEED = '<html><head><title>' + TODAY + '</title></head><body><article class="reading-card"><h4>FIRST READING</h4><p>First body.</p></article></body></html>';

async function buildPage(appJs, opts) {
  opts = opts || {};
  const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = require2('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const store = opts.store || freshStore();
  const page = await browser.newPage();
  if (opts.seedPlayed) {
    const ctx = page.context();
    await ctx.addInitScript((s) => { try { localStorage.setItem('opn-played-v344', JSON.stringify(s)); } catch (e) {} }, opts.seedPlayed);
  }
  const settingsAnswer = opts.settingsAnswer || { ok: true, version: 8, sources: [] };
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.addInitScript(({ bookJson, settingsJson, massJson, biyJson, ciyJson, podindexJson }) => {
    window.__store = null;
    window.__putLog = [];
    window.fetch = function (url, options) {
      const u = String(url);
      const ans = (body, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])), headers: { get: () => null } });
      try {
        const method = (options && options.method) || 'GET';
        if (method === 'PUT' && u.indexOf('/api/prayer/profiles/') >= 0) {
          const body = JSON.parse((options && options.body) || '{}');
          window.__putLog.push({ path: u, body: body });
          const st = window.__store;
          // v517 §2: the stub store mirrors the shipped
          // server contract for save + delete.
          if (u.indexOf('/save') >= 0) {
            if (body.key) {
              const p = st.profiles.find((x) => x.key === body.key);
              if (!p) return ans({ error: 'bad profile ' + body.key }, 400);
              if (p.kind === 'default') return ans({ error: 'the named profiles cannot be changed — save as new' }, 400);
              p.name = body.name; p.honorLine = body.honorLine || ''; p.coreBlocks = (body.coreBlocks || []).slice(); p.layers = JSON.parse(JSON.stringify(body.layers || {}));
            } else {
              let slug = String(body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile';
              let k = slug, n = 2;
              while (st.profiles.some((x) => x.key === k)) { k = slug + '-' + n; n++; }
              st.profiles.push({ key: k, name: body.name, honorLine: body.honorLine || '', kind: 'custom', coreBlocks: (body.coreBlocks || []).slice(), layers: JSON.parse(JSON.stringify(body.layers || {})) });
            }
            st.state.version++;
            return ans(window.__profilesAnswer());
          }
          if (u.indexOf('/delete') >= 0) {
            const p = st.profiles.find((x) => x.key === body.profileKey);
            if (!p) return ans({ error: 'bad profile ' + (body.profileKey || '(empty)') }, 400);
            if (p.kind === 'default') return ans({ error: 'the named profiles cannot be deleted' }, 400);
            st.profiles = st.profiles.filter((x) => x.key !== p.key);
            if (st.pick === p.key) st.pick = null;
            if (st.state.standingKey === p.key) st.state.standingKey = 'salesian';
            st.state.version++;
            return ans(window.__profilesAnswer());
          }
          if (u.indexOf('/day-pick') >= 0) { st.pick = body.profileKey || null; st.state.version++; }
          if (u.indexOf('/layers') >= 0) { const p = st.profiles.find((x) => x.key === body.profileKey); if (p) p.layers = body.layers; st.state.version++; }
          if (u.indexOf('/state') >= 0) { if (body.standingKey) st.state.standingKey = body.standingKey; if (typeof body.dayRule === 'boolean') st.state.dayRule = body.dayRule; st.state.version++; }
          return ans(window.__profilesAnswer());
        }
        if (u.indexOf('/api/prayer/profiles') >= 0) return ans(window.__profilesAnswer());
        if (u.indexOf('/api/player/day') >= 0) return ans(window.__dayFor());
        if (u.indexOf('/api/player/source-settings') >= 0) return ans(JSON.parse(settingsJson));
        if (u.indexOf('/api/player/podcasts?series=bible-in-a-year') >= 0) return ans(JSON.parse(biyJson));
        if (u.indexOf('/api/player/podcasts?series=catechism-in-a-year') >= 0) return ans(JSON.parse(ciyJson));
        if (u.indexOf('/api/player/podcasts') >= 0) return ans(JSON.parse(podindexJson));
        if (u.indexOf('/api/prayer/book/favorites') >= 0) return ans({ ok: true, favorites: [] });
        if (u.indexOf('/api/prayer/book') >= 0) return ans(JSON.parse(bookJson));
        if (u.indexOf('/api/prayer/mass-personal-prayer') >= 0) return ans({ ok: true, before: null, after: null, afterMass: [], preMass: [] });
        if (u.indexOf('/api/mass/readings') >= 0 || u.indexOf('/api/mass') >= 0) return ans(JSON.parse(massJson));
        return ans({ ok: true });
      } catch (e) { return ans({ ok: false, error: String(e) }, 500); }
    };
    window.__extFetchText = function () { return Promise.reject(new Error('offline')); };
    URL.createObjectURL = function () { return 'blob:fake'; };
    URL.revokeObjectURL = function () {};
    HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function () { el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () {};
  }, { bookJson: JSON.stringify(BOOK), settingsJson: JSON.stringify(settingsAnswer), massJson: JSON.stringify(MASS_PAYLOAD), biyJson: JSON.stringify(BIY), ciyJson: JSON.stringify(CIY), podindexJson: JSON.stringify(PODINDEX) });
  await page.addInitScript(({ storeJson, foldOfSrc, mkBlockStubSrc, tracksJson, captionsJson, todayStr, dateLabel }) => {
    const TRACKS = JSON.parse(tracksJson); const CAPTIONS = JSON.parse(captionsJson);
    const mkBlockStub = eval('(' + mkBlockStubSrc + ')');
    const foldOf = eval('(' + foldOfSrc + ')');
    window.__store = JSON.parse(storeJson);
    window.__dayFor = function () {
      const st = window.__store;
      const eff = st.pick ? st.profiles.find((p) => p.key === st.pick) : st.profiles.find((p) => p.key === st.state.standingKey);
      const fold = foldOf(eff, st.pick ? 'pick' : 'standing', st.state.version);
      const blocks = eff.coreBlocks.map((b) => mkBlockStub(b));
      if (eff.layers.novenas.on) blocks.push(mkBlockStub('Novenas', 'novenas'));
      if (eff.layers.podcasts.on) blocks.push({ block: 'Podcasts', label: 'Podcasts', caption: 'the podcasts you added', spotifyUrl: null, tracks: [], trackCount: 0, layer: 'podcasts' });
      return { ok: true, date: todayStr, dateLabel: dateLabel, presentedDay: todayStr, version: 8, introTexts: {}, blocks: blocks, dayPositions: {}, blockOrder: null, additions: [], profile: fold };
    };
    window.__profilesAnswer = function () {
      const st = window.__store;
      return { ok: true, profiles: JSON.parse(JSON.stringify(st.profiles)), state: { standingKey: st.state.standingKey, dayRule: st.state.dayRule, version: st.state.version }, effective: window.__dayFor().profile };
    };
  }, { storeJson: JSON.stringify(store), foldOfSrc: foldOf.toString(), mkBlockStubSrc: mkBlockStub.toString(), tracksJson: JSON.stringify(TRACKS), captionsJson: JSON.stringify(CAPTIONS), todayStr: TODAY, dateLabel: DATE_LABEL });
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v517</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + (opts.baseShell ? SHELL_BASE : SHELL) + '\n<script>' + appJs + '</' + 'script></body></html>';
  const server = http.createServer((req, res) => {
    if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { setTab('prayers'); });
  await page.waitForTimeout(1500);
  return { page, browser, server, errs, store };
}
const homeRows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#view [data-openblock]')).map((el) => el.getAttribute('data-openblock')));
const homeCounts = (page) => page.evaluate(() => { const o = {}; document.querySelectorAll('#view [data-openblock]').forEach((el) => { const c = el.querySelector('[data-bcount]'); o[el.getAttribute('data-openblock')] = c ? c.textContent : null; }); return o; });
async function openBookPage(page, slug) {
  await page.evaluate(() => { switchSide('prayers', 'book'); });
  await page.waitForTimeout(300);
  await page.evaluate((s) => { openPrayerPage(s); }, slug);
  await page.waitForTimeout(400);
}
async function ensureExpanded(page) {
  const has = await page.evaluate(() => !!document.querySelector('[data-profchange]'));
  if (!has) { await page.click('[data-profexpand]'); await page.waitForTimeout(400); }
}
async function openChangeSheet(page) {
  await ensureExpanded(page);
  await page.click('[data-profchange]');
  await page.waitForTimeout(900);
}

if (!PROBE) {
  /* C1–C7: collapsed card, expand, toggles, copy-mode editor, save-as-new, pick */
  {
    const { page, browser, server, errs } = await buildPage(APP_JS);
    const cold = await page.evaluate(() => {
      const c = document.querySelector('.profcard');
      return {
        name: c ? (c.querySelector('h3') || {}).textContent : null,
        text: c ? c.textContent : '',
        expand: !!document.querySelector('[data-profexpand]'),
        expandLabel: (document.querySelector('[data-profexpand]') || {}).textContent,
        change: !!document.querySelector('[data-profchange]'),
        layer: !!document.querySelector('[data-proflayer]'),
        podpick: !!document.querySelector('[data-podpick]'),
        customize: !!document.querySelector('[data-profcustomize]'),
      };
    });
    ok(cold.name === 'The Salesian Way' && cold.text.indexOf('Your standing default') >= 0 && cold.text.indexOf('honor of the tradition') >= 0
      && cold.expand && cold.expandLabel === 'Edit' && !cold.change && !cold.layer && !cold.podpick && !cold.customize,
      'C1: a cold open paints the card COLLAPSED — the name, the resolution line, and the honor line stand; Change, the layer acts, Choose podcasts, and Customize are all absent; the Edit act stands',
      JSON.stringify(cold));
    ok(errs.length === 0, 'C2: the page boots clean (no page errors)', errs.join(' ; '));
    await page.click('[data-profexpand]');
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => ({
      change: !!document.querySelector('[data-profchange]'),
      nov: !!document.querySelector('[data-proflayer="novenas"]'),
      pod: !!document.querySelector('[data-proflayer="podcasts"]'),
      podpick: !!document.querySelector('[data-podpick]'),
      customize: !!document.querySelector('[data-profcustomize]'),
      expandLabel: (document.querySelector('[data-profexpand]') || {}).textContent,
    }));
    ok(open.change && open.nov && open.pod && open.podpick && open.customize && open.expandLabel === 'Done',
      'C3: expand paints the standing acts unchanged (Change · Novenas · Podcasts · Choose podcasts, podcasts on in the fixture store) plus the Customize act', JSON.stringify(open));
    await page.click('[data-proflayer="novenas"]');
    await page.waitForTimeout(1500);
    const rowsOff = await homeRows(page);
    await page.click('[data-proflayer="novenas"]');
    await page.waitForTimeout(1500);
    const rowsOn = await homeRows(page);
    const counts = await homeCounts(page);
    ok(JSON.stringify(rowsOff) === '["Morning","Midday","Evening","Night","Podcasts"]'
      && JSON.stringify(rowsOn) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]' && counts['Novenas'] === '2 tracks',
      'C4: the Novenas toggle from the expanded card removes the whole group and restores it whole',
      JSON.stringify(rowsOff) + ' -> ' + JSON.stringify(rowsOn) + ' ' + JSON.stringify(counts));
    await page.click('[data-profexpand]');
    await page.waitForTimeout(400);
    const collapsed = await page.evaluate(() => !!document.querySelector('[data-profchange]') || !!document.querySelector('[data-profcustomize]'));
    ok(!collapsed, 'C5: collapse hides the card acts again');
    /* the Change sheet's Edit acts + the copy-mode editor */
    await openChangeSheet(page);
    const editCount = await page.evaluate(() => document.querySelectorAll('[data-profedit]').length);
    ok(editCount >= 6, 'C6: the Change sheet\'s rows carry Edit acts (the For-today list and the Standing default list)', 'count=' + editCount);
    await page.click('[data-profedit="salesian"]');
    await page.waitForTimeout(900);
    const ed = await page.evaluate(() => {
      const s = document.querySelector('.profedit');
      return s ? {
        title: (s.querySelector('h1') || {}).textContent,
        text: s.textContent,
        saveNew: !!s.querySelector('[data-edsave="new"]'),
        saveOver: !!s.querySelector('[data-edsave="over"]'),
        del: !!s.querySelector('[data-eddelete]'),
      } : null;
    });
    ok(ed && ed.title === 'Customize profile' && ed.saveNew && !ed.saveOver && !ed.del
      && ed.text.indexOf('The named profiles cannot be changed') >= 0,
      'C7: Edit on The Salesian Way opens the editor in copy mode — Save-as-new only, no Save-over, no Delete, the defaults note standing', JSON.stringify(ed));
    /* editor acts, then Save-as-new */
    await page.click('[data-edon="Midmorning"]');
    await page.waitForTimeout(300);
    await page.click('[data-edup="Evening"]');
    await page.waitForTimeout(300);
    const biyChosen = await page.evaluate(() => {
      const row = document.querySelector('[data-edseries="bible-in-a-year"]');
      return row ? row.textContent.indexOf('✓') >= 0 : false;
    });
    if (!biyChosen) { await page.click('[data-edseries="bible-in-a-year"]'); await page.waitForTimeout(300); }
    await page.fill('[data-edname]', 'My Salesian');
    await page.click('[data-edsave="new"]');
    await page.waitForTimeout(1600);
    const gained = await page.evaluate(() => {
      const p = window.__store.profiles.find((x) => x.key === 'my-salesian');
      return p ? { kind: p.kind, core: p.coreBlocks, biy: (p.layers.podcasts.series || []).indexOf('bible-in-a-year') >= 0 } : null;
    });
    ok(gained && gained.kind === 'custom' && JSON.stringify(gained.core) === '["Morning","Evening","Midday","Night","Midmorning"]' && gained.biy,
      'C8: in the editor — Midmorning stood up, Evening moved up, the series checklist carrying bible-in-a-year — Save-as-new gains the custom in the stub store', JSON.stringify(gained));
    await openChangeSheet(page);
    const listed = await page.evaluate(() => !!document.querySelector('[data-profpick="my-salesian"]'));
    await page.click('[data-profpick="my-salesian"]');
    await page.waitForTimeout(1600);
    const rows = await homeRows(page);
    const cardName = await page.evaluate(() => { const c = document.querySelector('.profcard'); return c ? (c.querySelector('h3') || {}).textContent : ''; });
    ok(listed && JSON.stringify(rows) === '["Morning","Evening","Midday","Night","Midmorning","Novenas","Podcasts"]' && cardName === 'My Salesian',
      'C9: the Change sheet lists the custom; picking it rebuilds the home to its composed shape (core order, then the layer groups)',
      JSON.stringify(rows) + ' card=' + cardName);
    await browser.close(); server.close();
  }
  /* C10–C12: save-over + delete on a custom, the played mark standing */
  {
    const store2 = freshStore();
    store2.profiles.push({ key: 'evening-lite', name: 'Evening Lite', honorLine: '', kind: 'custom', coreBlocks: ['Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } });
    const seed = {}; seed['morning-prayer'] = {}; seed['morning-prayer'][TODAY] = { source: 'manual', block: 'Morning' };
    const { page, browser, server } = await buildPage(APP_JS, { store: store2, seedPlayed: seed });
    const stillBefore = await page.evaluate((t) => isPlayed('morning-prayer', t, 'Morning'), TODAY);
    await openChangeSheet(page);
    await page.click('[data-profedit="evening-lite"]');
    await page.waitForTimeout(900);
    const edMode = await page.evaluate(() => {
      const s = document.querySelector('.profedit');
      return s ? { over: !!s.querySelector('[data-edsave="over"]'), del: !!s.querySelector('[data-eddelete]') } : null;
    });
    await page.click('[data-edup="Night"]');
    await page.waitForTimeout(300);
    await page.click('[data-edsave="over"]');
    await page.waitForTimeout(1600);
    const afterSave = await page.evaluate(() => {
      const p = window.__store.profiles.find((x) => x.key === 'evening-lite');
      return p ? p.coreBlocks : null;
    });
    await openChangeSheet(page);
    await page.click('[data-profpick="evening-lite"]');
    await page.waitForTimeout(1600);
    const rows = await homeRows(page);
    ok(edMode && edMode.over && edMode.del && JSON.stringify(afterSave) === '["Night","Evening"]'
      && JSON.stringify(rows) === '["Night","Evening","Novenas"]',
      'C10: the editor on the custom stands in edit mode; Save-over after moving Night first — the store and the rebuilt home follow the new order',
      JSON.stringify(edMode) + ' ' + JSON.stringify(afterSave) + ' ' + JSON.stringify(rows));
    await openChangeSheet(page);
    await page.click('[data-profedit="evening-lite"]');
    await page.waitForTimeout(900);
    await page.click('[data-eddelete]');
    await page.waitForTimeout(300);
    const armed = await page.evaluate(() => (document.querySelector('[data-eddelete]') || {}).textContent);
    await page.click('[data-eddelete]');
    await page.waitForTimeout(1600);
    const afterDelete = await page.evaluate(() => ({
      gone: !window.__store.profiles.some((x) => x.key === 'evening-lite'),
      pick: window.__store.pick,
    }));
    const rowsBack = await homeRows(page);
    const cardName = await page.evaluate(() => { const c = document.querySelector('.profcard'); return c ? (c.querySelector('h3') || {}).textContent : ''; });
    ok(armed === 'Tap again to delete' && afterDelete.gone && afterDelete.pick === null
      && cardName === 'The Salesian Way' && JSON.stringify(rowsBack) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]',
      'C11: Delete arms on the first tap and deletes on the second — the store loses the custom and the day falls back to the standing default',
      'armed=' + armed + ' ' + JSON.stringify(afterDelete) + ' ' + JSON.stringify(rowsBack));
    const stillAfter = await page.evaluate((t) => isPlayed('morning-prayer', t, 'Morning'), TODAY);
    ok(stillBefore === true && stillAfter === true,
      'C12: a played mark seeded on a Morning episode stands after a switch to the custom and back', 'before=' + stillBefore + ' after=' + stillAfter);
    await browser.close(); server.close();
  }
  /* C13: the byte-identity negative */
  {
    const a = await buildPage(APP_JS);
    const b = await buildPage(APP_JS_BASE, { baseShell: true });
    const slug = 'prayer-for-the-departed-souls';
    await openBookPage(a.page, slug); await openBookPage(b.page, slug);
    const ha = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const hb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(ha === hb, 'C13: a non-pilot prayer page stands byte-identical to the base ship\'s',
      'len ' + ha.length + ' vs ' + hb.length);
    await a.browser.close(); a.server.close(); await b.browser.close(); b.server.close();
  }
}

console.log('\nharness-v517: ' + pass + ' ok, ' + fail + ' not-ok' + (failures.length ? ' — ' + failures.join(' · ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
