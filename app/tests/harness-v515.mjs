// harness-v515.mjs — v515 evidence: Prayer Profiles I
// (the three defaults with switching that rebuilds today,
// the layer acts, migration 0038). John approved the v514
// Plan and ordered Ship (Ora thread, 2026-11-17 18:57 CT).
//   S statics: the migration's tables + seeds · the index.ts
//     fold/route invariants · the client validity-key,
//     Podcasts-layer, profile-surface, and played-dot
//     invariants · the Mass sources byte-identical to the
//     base ship · ui.ts differing from the base only in the
//     pin and the one .poddot rule · the fixtures stand
//   M migration: 0038 applies clean in sqlite — the three
//     tables' shapes stand, the seeds read back exact
//   W worker (local wrangler + fixture D1, the v395 mold):
//     Stage A (D1 through 0037) — the day payload stands as
//     the standing seven with profile null, the profiles
//     read empty · Stage B (0038 applied) — the three
//     defaults exact + the state; the ?date= resolutions
//     (Sunday → rule · solemnity → rule · memorial →
//     standing · outside coverage → standing); the day
//     composes to its effective profile; a pick for today
//     recomposes the day (little-way: Morning + Night
//     alone) and outranks the rule on a rule day; the
//     layer acts recompose (Novenas shell after the core ·
//     Podcasts shell last, the fold's series in order);
//     every write bumps the version by one; the untouched
//     folds (a day position, a podcast listen) read back
//     identical after the switches; an addition into a
//     stood-down block drops from the fold while its row
//     stands, and folds again when the block restores;
//     the validation negatives write nothing
//   C client (the v510 Chromium mold, stubbed fetch): the
//     home paints the profile card + the block rows in fold
//     order, stood-down blocks absent · the descriptor
//     order follows the fold · the Podcasts layer switched
//     on from the card — the Podcasts row stands last, its
//     page shows each series' current episode once in
//     layer order, the group's dot is the plain listens
//     span · a played mark survives a switch to The Little
//     Way · the Novenas toggle removes and restores the
//     group whole · the cache legs: a record stamped with
//     a stale profile version does not stand, a record
//     stamped with the standing fold's key + version does
//     · the slot picker under The Little Way offers
//     Morning + Night only · a non-pilot prayer page
//     byte-identical to the base ship's
//   R report (Plan P9.3): each default's composed runtime
//     on the fixture day, from the block totals — reported,
//     no gate on the labels
// Fixtures (Improvement D), under tests/fixtures-v515/,
// drawn from production on 2026-11-17 through the prayer
// door: (a) the live day payload (settings v8, the seven
// blocks in standing order, the Te Deum addition standing
// in Evening); (b) the live source settings (v8, 26 rows);
// (c) the live series index (bible-in-a-year current
// biy:day-318 · catechism-in-a-year current ciy:day-2);
// (d) the two live series payloads, entries trimmed to the
// current entry's neighborhood, fields whole; (e) the
// MASS_CALENDAR day-kind fixtures stand in the source file
// itself (2026-11-17 memorial · 2026-11-22 Sunday ·
// 2026-12-08 solemnity S · 2028-01-04 outside coverage);
// (f) the 2026-11-17 block runtime totals from the day's
// Spotify playlists, pulled live 2026-11-17 (used by R).
// The client stub's settings answer carries version 8 with
// NO source rows (the v510 harness's posture), so descriptor
// composition reads the payload tracks + the profile fold
// alone; the stub day payloads carry production-shaped
// tracks per block (the door payload carries tracks: [] —
// production resolves items from feeds at open). The stub
// profiles store mirrors the shipped server contract (the
// v510 daFold precedent). The base for byte comparisons is
// the v513 ship worktree (H515_BASE overrides).
// Run: node app/tests/harness-v515.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
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
const BASE = process.env.H515_BASE || path.resolve(ROOT, '../../.worktrees/v513-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v515';
const DAY_LIVE = JSON.parse(readFileSync(FX + '/day-live-2026-11-17.json', 'utf8'));
const SETTINGS_LIVE = JSON.parse(readFileSync(FX + '/settings-live-2026-11-17.json', 'utf8'));
const PODINDEX = JSON.parse(readFileSync(FX + '/podindex-live-2026-11-17.json', 'utf8'));
const BIY = JSON.parse(readFileSync(FX + '/series-bible-in-a-year-live-2026-11-17.json', 'utf8'));
const CIY = JSON.parse(readFileSync(FX + '/series-catechism-in-a-year-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const pp = {}; parts.forEach((x) => { pp[x.type] = x.value; });
const TODAY = pp.year + '-' + pp.month + '-' + pp.day;
const DATE_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const HONOR = "named in honor of the tradition, not the order's own routine";

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  ok(MIG38.includes('CREATE TABLE IF NOT EXISTS prayer_profiles') && MIG38.includes('CREATE TABLE IF NOT EXISTS prayer_profile_state')
    && MIG38.includes('CREATE TABLE IF NOT EXISTS prayer_profile_day_picks') && MIG38.includes("'little-way', 'The Little Way'")
    && MIG38.includes("'salesian', 'The Salesian Way'") && MIG38.includes("'benedictine', 'The Benedictine Way'")
    && MIG38.includes("(1, 'salesian', 1, 1, '2026-11-18T01:05:00.000Z')"),
    'S1: migration 0038 carries the three tables and the seeds (the three defaults + the state singleton)');
  ok(I_SRC.includes('import { MASS_CALENDAR } from "./mass-calendar";') && I_SRC.includes('function profileDayKind(')
    && I_SRC.includes('async function prayerProfileStore(') && I_SRC.includes('function profileResolve(')
    && I_SRC.includes('function profileFoldOf(') && I_SRC.includes('async function profilesPayload(')
    && I_SRC.includes('profile: profileFold,') && I_SRC.includes('new Set<string>([...profileCore, ...(profileNovenasOn ? ["Novenas"] : [])])'),
    'S2: index.ts carries the profile store, the day-kind derivation, the resolution, the fold, and the payload wiring');
  ok(I_SRC.includes('seg[2] === "profiles" && !seg[3] && request.method === "GET"')
    && I_SRC.includes('seg[3] === "state" && request.method === "PUT"') && I_SRC.includes('seg[3] === "day-pick" && request.method === "PUT"')
    && I_SRC.includes('seg[3] === "layers" && request.method === "PUT"') && I_SRC.includes('seg[3] === "profiles" && request.method === "GET"'),
    'S3: index.ts carries the four session profile routes and the door mirror');
  ok(C_SRC.includes('cache.profileKey === fold.key && cache.profileVersion === fold.version')
    && C_SRC.includes('function podDayDesc(') && C_SRC.includes('function resolveProfilePodcasts(')
    && C_SRC.includes("if (b.layer === 'podcasts')") && C_SRC.includes('function profileCardHtml(')
    && C_SRC.includes('function openProfileSheet(') && C_SRC.includes('function openPodcastPicker(')
    && C_SRC.includes('function appendBlockPodcastCards(') && C_SRC.includes('data-poddot') && C_SRC.includes('var stepBlocks'),
    'S4: client.ts carries the validity key, the Podcasts layer build, the profile surface, and the standing-groups picker');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S5-' + f + ': the Mass source stands byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripPoddot = (s) => s.replace(/\/\* v515: the Podcasts group's plain dot[\s\S]*?\.played-dot\.poddot \{ cursor:default; \}\n/, '');
  ok(pin(stripPoddot(U_SRC)) === pin(stripPoddot(U_BASE)),
    'S6: ui.ts is byte-identical to the base ship outside the pin line and the one .poddot rule');
  ok(DAY_LIVE.blocks.map((b) => b.block).join(',') === 'Novenas,Morning,Midmorning,Midday,Afternoon,Evening,Night' && DAY_LIVE.version === 8,
    'S7: the live day fixture stands (the seven blocks in standing order, settings v8)');
  ok(SETTINGS_LIVE.version === 8 && SETTINGS_LIVE.sources.length === 26,
    'S8: the live settings fixture stands (v8, 26 rows)');
  const idxByKey = {}; (PODINDEX.seriesList || []).forEach((s) => { idxByKey[s.series] = s; });
  ok(idxByKey['bible-in-a-year'] && idxByKey['bible-in-a-year'].currentKey === 'biy:day-318'
    && idxByKey['catechism-in-a-year'] && idxByKey['catechism-in-a-year'].currentKey === 'ciy:day-2'
    && BIY.currentKey === 'biy:day-318' && CIY.currentKey === 'ciy:day-2',
    'S9: the series fixtures stand (index + payloads; currents biy:day-318 · ciy:day-2)');
}

/* ---------------- M: the migration proof ---------------- */
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
    'rows = db.execute("SELECT key, name, honor_line, kind, core_blocks, layers FROM prayer_profiles ORDER BY sort_order").fetchall()',
    'assert [r[0] for r in rows] == ["little-way","salesian","benedictine"], rows',
    'assert all(r[2] == "named in honor of the tradition, not the order\'s own routine" and r[3] == "default" for r in rows), rows',
    'assert json.loads(rows[0][4]) == ["Morning","Night"] and json.loads(rows[0][5]) == {"novenas":{"on":0},"podcasts":{"on":0,"series":[]}}, rows[0]',
    'assert json.loads(rows[1][4]) == ["Morning","Midday","Evening","Night"] and json.loads(rows[1][5])["novenas"] == {"on":1}, rows[1]',
    'assert json.loads(rows[2][4]) == ["Morning","Midmorning","Midday","Afternoon","Evening","Night"] and json.loads(rows[2][5])["novenas"] == {"on":1}, rows[2]',
    'st = db.execute("SELECT id, standing_key, day_rule, version FROM prayer_profile_state").fetchall()',
    'assert st == [(1, "salesian", 1, 1)], st',
    'assert db.execute("SELECT COUNT(*) FROM prayer_profile_day_picks").fetchone()[0] == 0',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v515-mig.py');
  writeFileSync(tmp, py);
  const f38 = path.join(os.tmpdir(), 'harness-v515-0038.sql');
  writeFileSync(f38, MIG38);
  let migOut = '';
  try { migOut = execFileSync('python3', [tmp, f38], { encoding: 'utf8' }); }
  catch (e) { migOut = 'ERR ' + String(e.stdout || e.message).slice(0, 240); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real 0038 applies clean — the table shapes stand and the seeds read back exact (cores, layers, the state singleton, no picks)',
    migOut.trim().slice(0, 200));
}

/* ---------------- W: the worker round-trip ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PERSIST = path.join(APP, '.wrangler-test-v515');
const WPORT = 8797;
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-v515-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h515-'));
function wranglerD1(args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(APP, 'wrangler.toml'), '--persist-to', PERSIST, ...args],
    { cwd: APP, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function wranglerD1File(file) { return wranglerD1(['--file', file]); }
function migFiles(through) {
  const dir = path.join(APP, 'migrations');
  return readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()
    .filter((f) => !through || f <= through).map((f) => path.join(dir, f));
}
function applyFiles(files) {
  rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, 'mig-joined.sql');
  writeFileSync(f, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1File(f);
}
function applySql(sql) {
  const f = path.join(TMPD, 'one-' + Math.random().toString(36).slice(2, 8) + '.sql');
  writeFileSync(f, sql);
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
const composedFor = (prof) => {
  const names = (prof.coreBlocks || []).slice();
  const nov = (prof.layers || []).find((l) => l.key === 'novenas');
  const pod = (prof.layers || []).find((l) => l.key === 'podcasts');
  if (nov && nov.on) names.push('Novenas');
  if (pod && pod.on) names.push('Podcasts');
  return names;
};

if (!PROBE) {
  try {
    /* Stage A — D1 through 0037: the pre-0038 posture */
    applyFiles(migFiles('0037_prayer_day_additions.sql'));
    startApp();
    ok(await waitUp(), 'W0: app up on local wrangler (LOCAL_DEV harness mode), D1 through 0037');
    {
      const day = (await doorDay()).body;
      ok(JSON.stringify(blockNames(day)) === JSON.stringify(['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'])
        && (day.profile === null || day.profile === undefined),
        'W1: with the profile tables absent the day stands as the standing seven in standing order, profile null (the pre-0038 posture)',
        JSON.stringify(blockNames(day)) + ' profile=' + JSON.stringify(day.profile));
      const prof = (await doorProfiles()).body;
      ok(prof.state === null && Array.isArray(prof.profiles) && prof.profiles.length === 0 && prof.effective === null,
        'W2: the profiles read answers empty with the tables absent — never an error', JSON.stringify(prof).slice(0, 160));
    }
    /* Stage B — 0038 applied */
    wranglerD1File(path.join(APP, 'migrations', '0038_prayer_profiles.sql'));
    let expectedVersion = 1;
    {
      const prof = (await doorProfiles()).body;
      const byKey = {}; (prof.profiles || []).forEach((p) => { byKey[p.key] = p; });
      ok(['little-way', 'salesian', 'benedictine'].every((k) => byKey[k])
        && byKey['little-way'].name === 'The Little Way' && byKey['salesian'].name === 'The Salesian Way' && byKey['benedictine'].name === 'The Benedictine Way'
        && ['little-way', 'salesian', 'benedictine'].every((k) => byKey[k].honorLine === HONOR && byKey[k].kind === 'default')
        && JSON.stringify(byKey['little-way'].coreBlocks) === '["Morning","Night"]'
        && JSON.stringify(byKey['salesian'].coreBlocks) === '["Morning","Midday","Evening","Night"]'
        && JSON.stringify(byKey['benedictine'].coreBlocks) === '["Morning","Midmorning","Midday","Afternoon","Evening","Night"]'
        && byKey['little-way'].layers.novenas.on === false && byKey['salesian'].layers.novenas.on === true && byKey['benedictine'].layers.novenas.on === true
        && ['little-way', 'salesian', 'benedictine'].every((k) => byKey[k].layers.podcasts.on === false),
        'W3: the door profiles read carries the three defaults exact (names, the honor line, cores, layer defaults)');
      ok(prof.state && prof.state.standingKey === 'salesian' && prof.state.dayRule === true && prof.state.version === 1,
        'W4: the state singleton reads salesian · rule on · version 1', JSON.stringify(prof.state));
      const sun = (await doorProfiles('2026-11-22')).body.effective;
      ok(sun && sun.key === 'benedictine' && sun.resolvedBy === 'rule' && sun.dayKind === 'sunday',
        'W5: 2026-11-22 (Sunday, Christ the King) resolves to The Benedictine Way by the day rule', JSON.stringify(sun));
      const sol = (await doorProfiles('2026-12-08')).body.effective;
      ok(sol && sol.key === 'benedictine' && sol.resolvedBy === 'rule' && sol.dayKind === 'solemnity',
        'W6: 2026-12-08 (solemnity, the Immaculate Conception) resolves to The Benedictine Way by the day rule', JSON.stringify(sol));
      const mem = (await doorProfiles('2026-11-17')).body.effective;
      ok(mem && mem.key === 'salesian' && mem.resolvedBy === 'standing' && mem.dayKind === 'weekday',
        'W7: 2026-11-17 (a memorial weekday) resolves to The Salesian Way, the standing default', JSON.stringify(mem));
      const out = (await doorProfiles('2028-01-04')).body.effective;
      ok(out && out.key === 'salesian' && out.resolvedBy === 'standing' && out.dayKind === 'weekday',
        'W8: 2028-01-04 (outside calendar coverage) falls back to the standing default, the fold saying weekday', JSON.stringify(out));
      const day = (await doorDay()).body;
      const eff = (await doorProfiles(TODAY)).body.effective;
      ok(day.profile && day.profile.key === eff.key && day.profile.version === 1
        && JSON.stringify(blockNames(day)) === JSON.stringify(composedFor(eff)),
        'W9: the presented day composes to its effective profile (core in profile order, layer groups after)', JSON.stringify(blockNames(day)));
      ok(!(day.blocks || []).some((b) => b.layer === 'podcasts') && (eff.key !== 'salesian' || (day.blocks || []).filter((b) => b.block === 'Novenas').length === 1),
        'W10: no Podcasts shell stands while the layer is off; the Novenas shell stands once, after the core');
    }
    /* the untouched folds, seeded before the switches */
    applySql(`INSERT INTO day_positions (date, episode_id, position_s, duration_s, updated_at) VALUES ('${TODAY}', 'morning-prayer', 42, 720, '2026-11-17T00:00:00.000Z');
INSERT INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES ('bible-in-a-year', 'biy:day-1', '2026-11-12T18:00:00.000Z', '${TODAY}', 'manual');
INSERT INTO prayer_day_additions (date, block, slug, lang, after_id, seq, created_at) VALUES ('${TODAY}', 'Midmorning', 'anima-christi', 'en', NULL, 0, '2026-11-17T00:00:00.000Z');`);
    const listenRow = () => d1q("SELECT series, seq_key, listened_at, listen_date, source FROM podcast_listens WHERE series = 'bible-in-a-year'");
    const listenBefore = JSON.stringify(listenRow());
    {
      const day = (await doorDay()).body;
      ok(day.dayPositions && day.dayPositions['morning-prayer'] === 42,
        'W11: the seeded day position folds into the presented day before any switch', JSON.stringify(day.dayPositions));
      ok(!(day.additions || []).some((a) => a.slug === 'anima-christi'),
        'W12: the Midmorning addition does not fold while Midmorning stands down (today\'s shape), its row standing', JSON.stringify(day.additions));
    }
    /* the switches */
    {
      const r = await wput('/api/prayer/profiles/day-pick', { date: TODAY, profileKey: 'little-way' });
      expectedVersion++;
      ok(r.status === 200 && r.body.state && r.body.state.version === expectedVersion,
        'W13: the day-pick write answers 200 and the version bumps by exactly one', JSON.stringify(r.body.state));
      const day = (await doorDay()).body;
      ok(day.profile && day.profile.key === 'little-way' && day.profile.resolvedBy === 'pick'
        && JSON.stringify(blockNames(day)) === '["Morning","Night"]'
        && day.dayPositions && day.dayPositions['morning-prayer'] === 42,
        'W14: a pick for today recomposes the day — The Little Way: Morning + Night alone, resolved by pick, the day position untouched',
        JSON.stringify(blockNames(day)) + ' ' + JSON.stringify(day.profile));
      const sun = (await doorProfiles('2026-11-22')).body;
      ok(sun.effective && sun.effective.key === 'benedictine' && sun.effective.resolvedBy === 'rule',
        'W15: the Sunday still resolves by rule before its own pick', JSON.stringify(sun.effective));
      const rp = await wput('/api/prayer/profiles/day-pick', { date: '2026-11-22', profileKey: 'little-way' });
      expectedVersion++;
      const sun2 = (await doorProfiles('2026-11-22')).body;
      ok(rp.status === 200 && sun2.effective && sun2.effective.key === 'little-way' && sun2.effective.resolvedBy === 'pick',
        'W16: a pick on the Sunday outranks the rule (the pick IS the declaration)', JSON.stringify(sun2.effective));
      const rc = await wput('/api/prayer/profiles/day-pick', { date: '2026-11-22', profileKey: null });
      expectedVersion++;
      const sun3 = (await doorProfiles('2026-11-22')).body;
      ok(rc.status === 200 && sun3.effective && sun3.effective.key === 'benedictine' && sun3.effective.resolvedBy === 'rule',
        'W17: clearing the pick returns the Sunday to the rule', JSON.stringify(sun3.effective));
    }
    {
      const r = await wput('/api/prayer/profiles/layers', { profileKey: 'little-way', layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } });
      expectedVersion++;
      const day = (await doorDay()).body;
      const nov = (day.blocks || []).find((b) => b.block === 'Novenas');
      ok(r.status === 200 && JSON.stringify(blockNames(day)) === '["Morning","Night","Novenas"]' && nov && nov.layer === 'novenas',
        'W18: the Novenas layer act on The Little Way — the group stands after the core, marked as the layer', JSON.stringify(blockNames(day)));
      const r2 = await wput('/api/prayer/profiles/layers', { profileKey: 'little-way', layers: { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year', 'catechism-in-a-year'] } } });
      expectedVersion++;
      const day2 = (await doorDay()).body;
      const podShell = (day2.blocks || []).find((b) => b.layer === 'podcasts');
      const foldPod = (day2.profile.layers || []).find((l) => l.key === 'podcasts');
      ok(r2.status === 200 && JSON.stringify(blockNames(day2)) === '["Morning","Night","Novenas","Podcasts"]'
        && podShell && podShell.block === 'Podcasts' && JSON.stringify(foldPod.series) === '["bible-in-a-year","catechism-in-a-year"]',
        'W19: the Podcasts layer act — the Podcasts shell stands last and the fold carries the series in layer order',
        JSON.stringify(blockNames(day2)) + ' ' + JSON.stringify(foldPod));
      const r3 = await wput('/api/prayer/profiles/day-pick', { date: TODAY, profileKey: 'benedictine' });
      expectedVersion++;
      const day3 = (await doorDay()).body;
      ok(r3.status === 200 && (day3.additions || []).some((a) => a.slug === 'anima-christi' && a.block === 'Midmorning')
        && JSON.stringify(blockNames(day3)) === '["Morning","Midmorning","Midday","Afternoon","Evening","Night","Novenas"]',
        'W20: under a Midmorning shape the addition folds again (its row stood through the stood-down shapes)',
        JSON.stringify(blockNames(day3)) + ' additions=' + JSON.stringify(day3.additions));
      ok(JSON.stringify(listenRow()) === listenBefore,
        'W21: the podcast listen row reads back byte-identical after every switch (the listens store is never written by a profile act)');
      await wput('/api/prayer/profiles/day-pick', { date: TODAY, profileKey: null }); expectedVersion++;
      await wput('/api/prayer/profiles/layers', { profileKey: 'little-way', layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } }); expectedVersion++;
      const back = (await doorProfiles()).body;
      const lw = (back.profiles || []).find((p) => p.key === 'little-way');
      ok(back.state.version === expectedVersion && lw && lw.layers.novenas.on === false && lw.layers.podcasts.on === false,
        'W22: the store restores to its seed shape, the version having counted every write', 'version=' + back.state.version + ' expected=' + expectedVersion);
    }
    /* the validation negatives write nothing */
    {
      const v0 = (await doorProfiles()).body.state.version;
      const n1 = await wput('/api/prayer/profiles/day-pick', { date: TODAY, profileKey: 'nope' });
      const n2 = await wput('/api/prayer/profiles/layers', { profileKey: 'salesian', layers: { novenas: { on: true }, podcasts: { on: false, series: ['nope'] } } });
      const n3 = await wput('/api/prayer/profiles/state', { standingKey: 'nope' });
      const n4 = await wput('/api/prayer/profiles/day-pick', { date: 'Nov 22', profileKey: 'salesian' });
      const v1 = (await doorProfiles()).body.state.version;
      ok(n1.status === 400 && n2.status === 400 && n3.status === 400 && n4.status === 400 && v1 === v0,
        'W23: the validation negatives (unknown profile, unknown series, unknown standing key, a malformed date) are named 400s and the version does not move',
        [n1.status, n2.status, n3.status, n4.status].join(',') + ' v ' + v0 + '->' + v1);
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
function dayFor(store) {
  const eff = store.pick ? store.profiles.find((p) => p.key === store.pick) : store.profiles.find((p) => p.key === store.state.standingKey);
  const fold = foldOf(eff, store.pick ? 'pick' : 'standing', store.state.version);
  const blocks = eff.coreBlocks.map((b) => mkBlockStub(b));
  if (eff.layers.novenas.on) blocks.push(mkBlockStub('Novenas', 'novenas'));
  if (eff.layers.podcasts.on) blocks.push({ block: 'Podcasts', label: 'Podcasts', caption: 'the podcasts you added', spotifyUrl: null, tracks: [], trackCount: 0, layer: 'podcasts' });
  return { ok: true, date: TODAY, dateLabel: DATE_LABEL, presentedDay: TODAY, version: 8, introTexts: {}, blocks: blocks, dayPositions: {}, blockOrder: null, additions: [], profile: fold };
}
function freshStore() {
  return {
    profiles: [
      { key: 'little-way', name: 'The Little Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Night'], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } },
      { key: 'salesian', name: 'The Salesian Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } },
      { key: 'benedictine', name: 'The Benedictine Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } },
    ],
    state: { standingKey: 'salesian', dayRule: true, version: 3 },
    pick: null,
  };
}
function profilesAnswer(store) {
  const day = dayFor(store);
  return { ok: true, profiles: JSON.parse(JSON.stringify(store.profiles)), state: { standingKey: store.state.standingKey, dayRule: store.state.dayRule, version: store.state.version }, effective: day.profile };
}
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SHELL_BASE = U_BASE.slice(U_BASE.indexOf('SHELL_HTML = `') + 14, U_BASE.indexOf('`;', U_BASE.indexOf('SHELL_HTML = `')));
const MASS_PAYLOAD = { ok: true, date: TODAY, mass: { name: 'Tuesday of week 33 in Ordinary Time', rank: 'ferial', season: 'Ordinary Time', color: 'green', readings: [{ label: 'First Reading', cite: '2 Mc 6:18-31', text: 'Eleazar, one of the foremost scribes.' }, { label: 'Gospel', cite: 'Lk 19:1-10', text: 'Jesus came to Jericho.' }] } };
const MASS_FEED = '<html><head><title>' + TODAY + '</title></head><body><article class="reading-card"><h4>FIRST READING</h4><p>First body.</p></article></body></html>';
const SAINT_SOURCE = { family: 'external', slotId: 'ext-saint-of-the-day', block: 'Afternoon', enabled: 1, dayRule: 'daily', role: 'primary', feedUrl: null, spotifyPlaylistId: null, position: 0, sortOrder: 1 };
const SAINT_CACHE_SLOTS = { 'ext-saint-of-the-day': { state: 'present', title: 'Saint of the Day', streamUrl: 'https://audio.example/saint.mp3', durationSec: 300, sizeBytes: 1000, source: 'saint', block: 'Afternoon', sortOrder: 1 } };

async function buildPage(appJs, opts) {
  opts = opts || {};
  const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = require2('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const store = opts.store || freshStore();
  const ctxOpts = {};
  if (opts.seedPlayed) ctxOpts.initScript = (s) => { try { localStorage.setItem('opn-played-v344', JSON.stringify(s)); } catch (e) {} };
  const page = opts.seedPlayed ? await (await browser.newContext()).newPage() : await browser.newPage();
  if (opts.seedPlayed) {
    const ctx = page.context();
    await ctx.addInitScript((s) => { try { localStorage.setItem('opn-played-v344', JSON.stringify(s)); } catch (e) {} }, opts.seedPlayed);
  }
  if (opts.seedCache) {
    const ctx = page.context();
    await ctx.addInitScript((rec) => { try { localStorage.setItem('opn-ext-cache-v1', JSON.stringify(rec)); } catch (e) {} }, opts.seedCache);
  }
  const settingsAnswer = opts.settingsAnswer || { ok: true, version: 8, sources: [] };
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.addInitScript(({ dayJson, bookJson, profilesJson, settingsJson, massJson, massFeed, biyJson, ciyJson, podindexJson }) => {
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
  }, { dayJson: '{}', bookJson: JSON.stringify(BOOK), profilesJson: '{}', settingsJson: JSON.stringify(settingsAnswer), massJson: JSON.stringify(MASS_PAYLOAD), massFeed: MASS_FEED, biyJson: JSON.stringify(BIY), ciyJson: JSON.stringify(CIY), podindexJson: JSON.stringify(PODINDEX) });
  // the store + the answer builders ride as page globals (the
  // init script above reads them lazily at fetch time)
  await page.addInitScript(({ storeJson, dayForSrc, profilesAnswerSrc, foldOfSrc, mkBlockStubSrc, tracksJson, captionsJson, todayStr, dateLabel }) => {
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
  }, { storeJson: JSON.stringify(store), dayForSrc: '', profilesAnswerSrc: '', foldOfSrc: foldOf.toString(), mkBlockStubSrc: mkBlockStub.toString(), tracksJson: JSON.stringify(TRACKS), captionsJson: JSON.stringify(CAPTIONS), todayStr: TODAY, dateLabel: DATE_LABEL });
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v515</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + (opts.baseShell ? SHELL_BASE : SHELL) + '\n<script>' + appJs + '</' + 'script></body></html>';
  const server = http.createServer((req, res) => {
    if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForTimeout(2600);
  // the app boots to the Mass tab (v496); the legs stand on
  // the Pray tab — switch and let the day build settle
  await page.evaluate(() => { setTab('prayers'); });
  await page.waitForTimeout(1500);
  return { page, browser, server, errs, store };
}
const homeRows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#view [data-openblock]')).map((el) => el.getAttribute('data-openblock')));
const homeCounts = (page) => page.evaluate(() => { const o = {}; document.querySelectorAll('#view [data-openblock]').forEach((el) => { const c = el.querySelector('[data-bcount]'); o[el.getAttribute('data-openblock')] = c ? c.textContent : null; }); return o; });
async function openBookPage(page, slug) {
  // the v510 seams: the book side, then the prayer's page
  await page.evaluate(() => { switchSide('prayers', 'book'); });
  await page.waitForTimeout(300);
  await page.evaluate((s) => { openPrayerPage(s); }, slug);
  await page.waitForTimeout(400);
}

if (!PROBE) {
  /* C1–C2: the salesian day paints by its fold */
  {
    const { page, browser, server, errs } = await buildPage(APP_JS);
    const rows = await homeRows(page);
    ok(JSON.stringify(rows) === '["Morning","Midday","Evening","Night","Novenas"]',
      'C1: the home paints the block rows in fold order — the Salesian core, the Novenas layer after; Midmorning and Afternoon absent', JSON.stringify(rows));
    const card = await page.evaluate(() => {
      const c = document.querySelector('.profcard');
      return c ? { name: (c.querySelector('h3') || {}).textContent, text: c.textContent } : null;
    });
    ok(card && card.name === 'The Salesian Way' && card.text.indexOf('Your standing default') >= 0 && card.text.indexOf('honor of the tradition') >= 0,
      'C2: the profile card stands at the head of the Pray tab home — the effective profile, how it resolved, the honor line', JSON.stringify(card).slice(0, 200));
    const order = await page.evaluate(() => (state.dayDescs || []).map((d) => d.block + ':' + d.episodeId).join(' | '));
    ok(order === 'Morning:morning-prayer | Morning:daily-rosary | Midday:midday-prayer | Evening:evening-prayer | Night:night-prayer | Novenas:novena-st_catherine_of_alexandria | Novenas:novena-st_monica',
      'C3: the descriptor order follows the fold — core in profile order, the Novenas group after', order);
    ok(errs.length === 0, 'C4: the page boots clean on the fold day (no page errors)', errs.join(' ; '));
    await browser.close(); server.close();
  }
  /* C5: the Podcasts layer from the card */
  {
    const { page, browser, server } = await buildPage(APP_JS);
    await page.evaluate(() => {
      const st = window.__store;
      const sal = st.profiles.find((p) => p.key === 'salesian');
      sal.layers.podcasts.series = ['bible-in-a-year', 'catechism-in-a-year'];
    });
    await page.click('[data-proflayer="podcasts"]');
    await page.waitForTimeout(1600);
    const rows = await homeRows(page);
    ok(JSON.stringify(rows) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]',
      'C5: Podcasts switched on from the card — the Podcasts row stands last on the home', JSON.stringify(rows));
    const tail = await page.evaluate(() => (state.dayDescs || []).filter((d) => d.kind === 'podcast').map((d) => d.episodeId + ':' + d.podSeries).join(' | '));
    ok(tail === 'biy:day-318:bible-in-a-year | ciy:day-2:catechism-in-a-year',
      'C6: each added series lands its CURRENT episode once, in layer order, as a day descriptor', tail);
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(500);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#view [data-card]')).map((el) => el.getAttribute('data-card')));
    const dot = await page.evaluate(() => {
      const el = document.querySelector('[data-card="biy:day-318"]');
      if (!el) return 'nocard';
      const span = el.querySelector('[data-poddot]');
      const btn = el.querySelector('[data-markplayed]');
      return (span ? 'span' : 'nospan') + '/' + (btn ? 'btn' : 'nobtn');
    });
    ok(JSON.stringify(cards) === '["biy:day-318","ciy:day-2"]' && dot === 'span/nobtn',
      'C7: the Podcasts page shows the two current episodes as cards; the played dot is the plain listens span, never the day-store button',
      JSON.stringify(cards) + ' ' + dot);
    await browser.close(); server.close();
  }
  /* C8: the seeded played mark stands on the Morning page */
  {
    const seed = {}; seed['morning-prayer'] = {}; seed['morning-prayer'][TODAY] = { source: 'manual', block: 'Morning' };
    const s = await buildPage(APP_JS, { seedPlayed: seed });
    await s.page.evaluate(() => { openBlockPage('Morning'); });
    await s.page.waitForTimeout(600);
    const dotBefore = await s.page.evaluate(() => {
      const el = document.querySelector('[data-card="morning-prayer"] .played-dot');
      return el ? el.className : 'none';
    });
    ok(dotBefore.indexOf(' on') >= 0, 'C8: the seeded played mark stands on the Salesian day (the Morning page dot reads on)', dotBefore);
    await s.browser.close(); s.server.close();
  }
  /* C9–C10: a played mark survives a switch; the slot picker under The Little Way */
  {
    const seed = {}; seed['morning-prayer'] = {}; seed['morning-prayer'][TODAY] = { source: 'manual', block: 'Morning' };
    const { page, browser, server } = await buildPage(APP_JS, { seedPlayed: seed });
    await page.click('[data-profchange]');
    await page.waitForTimeout(900);
    await page.click('[data-profpick="little-way"]');
    await page.waitForTimeout(1600);
    const rows = await homeRows(page);
    const cardName = await page.evaluate(() => { const c = document.querySelector('.profcard'); return c ? c.textContent : ''; });
    const still = await page.evaluate((t) => isPlayed('morning-prayer', t, 'Morning'), TODAY);
    ok(JSON.stringify(rows) === '["Morning","Night"]' && cardName.indexOf('The Little Way') >= 0 && cardName.indexOf('Your pick for today') >= 0 && still === true,
      'C9: Change → The Little Way rebuilds today to Morning + Night, the card reads the pick, and the played mark stands untouched',
      JSON.stringify(rows) + ' still=' + still);
    await openBookPage(page, 'te-deum');
    const hasAdd = await page.evaluate(() => !!document.getElementById('book-add'));
    if (hasAdd) await page.click('#book-add');
    await page.waitForSelector('.sheet.slotpick', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const stepBlocks = await page.evaluate(() => Array.from(document.querySelectorAll('[data-slotblock]')).map((el) => el.getAttribute('data-slotblock')));
    ok(JSON.stringify(stepBlocks) === '["Morning","Night"]',
      'C10: the slot picker under The Little Way offers the standing groups only (Morning + Night)', JSON.stringify(stepBlocks));
    await browser.close(); server.close();
  }
  /* C11: the Novenas toggle removes and restores the group whole */
  {
    const { page, browser, server } = await buildPage(APP_JS);
    await page.click('[data-proflayer="novenas"]');
    await page.waitForTimeout(1500);
    const rowsOff = await homeRows(page);
    await page.click('[data-proflayer="novenas"]');
    await page.waitForTimeout(1500);
    const rowsOn = await homeRows(page);
    const counts = await homeCounts(page);
    ok(JSON.stringify(rowsOff) === '["Morning","Midday","Evening","Night"]'
      && JSON.stringify(rowsOn) === '["Morning","Midday","Evening","Night","Novenas"]' && counts['Novenas'] === '2 tracks',
      'C11: the Novenas toggle removes the whole group and restores it whole (all the day\'s novenas, 2 tracks)',
      JSON.stringify(rowsOff) + ' -> ' + JSON.stringify(rowsOn) + ' ' + JSON.stringify(counts));
    await browser.close(); server.close();
  }
  /* C12–C13: the cache legs on a Benedictine day (Afternoon stands for the saint slot) */
  {
    const benStore = freshStore();
    benStore.state.standingKey = 'benedictine';
    benStore.state.version = 7;
    const settingsWithSaint = { ok: true, version: 8, sources: [SAINT_SOURCE] };
    const stale = { date: TODAY, settingsVersion: 8, savedAt: new Date().toISOString(), slots: JSON.parse(JSON.stringify(SAINT_CACHE_SLOTS)), own: {}, intentions: null, profileKey: 'benedictine', profileVersion: 999 };
    const good = JSON.parse(JSON.stringify(stale)); good.profileVersion = 7;
    const a = await buildPage(APP_JS, { store: benStore, settingsAnswer: settingsWithSaint, seedCache: stale });
    const staleState = await a.page.evaluate(() => state.extSlots && state.extSlots['ext-saint-of-the-day'] ? state.extSlots['ext-saint-of-the-day'].state : 'absent');
    ok(staleState !== 'present', 'C12: a cache record stamped with a stale profile version does not stand (the slot re-resolves)', 'state=' + staleState);
    await a.browser.close(); a.server.close();
    const b = await buildPage(APP_JS, { store: JSON.parse(JSON.stringify(benStore)), settingsAnswer: settingsWithSaint, seedCache: good });
    const goodState = await b.page.evaluate(() => state.extSlots && state.extSlots['ext-saint-of-the-day'] ? state.extSlots['ext-saint-of-the-day'].state : 'absent');
    ok(goodState === 'present' || goodState === 'downloading',
      'C13: a cache record stamped with the standing fold\'s key + version stands', 'state=' + goodState);
    await b.browser.close(); b.server.close();
  }
  /* C14: the byte-identity negative */
  {
    const a = await buildPage(APP_JS);
    const b = await buildPage(APP_JS_BASE, { baseShell: true });
    const slug = 'prayer-for-the-departed-souls';
    await openBookPage(a.page, slug); await openBookPage(b.page, slug);
    const ha = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const hb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(ha === hb, 'C14: a non-pilot prayer page stands byte-identical to the base ship\'s',
      'len ' + ha.length + ' vs ' + hb.length);
    await a.browser.close(); a.server.close(); await b.browser.close(); b.server.close();
  }
}

/* ---------------- R: the runtime report (no gate) ---------------- */
{
  // Fixture (f): the 2026-11-17 block totals from the day's
  // Spotify playlists, pulled live 2026-11-17.
  const TOT = { Novenas: 1421, Morning: 4584, Midmorning: 1552, Midday: 775, Afternoon: 1183, Evening: 2231, Night: 1013 };
  const sum = (blocks, novenas) => blocks.reduce((a, b) => a + TOT[b], 0) + (novenas ? TOT.Novenas : 0);
  const fmt = (s) => Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const ben = sum(['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], true);
  const sal = sum(['Morning', 'Midday', 'Evening', 'Night'], true);
  const lit = sum(['Morning', 'Night'], false);
  console.log('R report: The Benedictine Way ' + fmt(ben) + ' · The Salesian Way ' + fmt(sal) + ' · The Little Way ' + fmt(lit) + ' (podcasts off in all three defaults)');
  ok(ben === 12759 && sal === 10024 && lit === 5597,
    'R1: the composed runtimes stand as the Plan reported (Benedictine 3:32:39 · Salesian 2:47:04 · Little Way 1:33:17)',
    ben + '/' + sal + '/' + lit);
}

console.log('\nharness-v515: ' + pass + ' ok, ' + fail + ' not-ok' + (failures.length ? ' — ' + failures.join(' · ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));


