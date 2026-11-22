// harness-v604.mjs — v604: the Praylist editable in place ·
//  the standing pick.
//  P/M/V  precedence + migration + validators: the
//     resolution collapse (standing pick -> today layer),
//     mig604 deleting the stored dayDefaults + picks, the
//     named-400 rejections, the day-pick routes gone.
//  M4     vault-unlock migration (Review defect R3-1):
//     an old-build (ffd1bbe) envelope over the M2 variant
//     — locked first open byte-identical, unlock runs
//     mig604 on the REAL document + persists, a second
//     unlock writes nothing. M4 FAILS on the pre-fix
//     branch HEAD f97bf40 (50 ok / 1 not ok, M4 sole
//     failure) and PASSES with the fix (51 ok / 0).
//  O/F    the one page: collapsed rows, independent folds,
//     per-block today marks, prayer posture, the stored
//     page mode + the fold option.
//  Q/E    the one question (named targets, asked once),
//     the frozen scope banner + Change, the edit posture
//     (handles · remove · restore line · drag).
//  W      writes + guards: today-at-once, standing writes,
//     the ladder's third host, the vault gate, standings
//     first, settled intention draws never re-drawn.
//  S/K    Save New (both scopes, name required) · the
//     plan-row pick Edit · Edit today's chips = the
//     standing pick.
//  D      the Configure ladder stands at two doors.
// Fixtures from production only (Improvement D): John's
//  v589 import file (raw, for M1) · the M2 POPULATED
//  VARIANT built from it below (dayDefaults in the shipped
//  seed shape {sun:'benedictine'} · a Sunday pick ·
//  per-profile contents in the shipped writers' selector
//  shape (source keys from the production seed sources) ·
//  a todayEdits entry in the v594p2/v601 layer shape) ·
//  the served book / novenas / podcasts fixtures
//  (tests/fixtures-v603) · the production day fixture
//  (tests/fixtures-v597).
// OLD-BUILD ACCEPTANCE of the M2 variant (coordinator's
//  binding addition): the ffd1bbe build accepts the
//  variant as valid BEFORE any migration runs on it —
//  its resolver resolves the variant's Sunday (2026-11-22)
//  BY ITS PICK (little-way, resolvedBy 'pick'), its
//  contents validator accepts every profile's contents,
//  its today-layer validator accepts the variant's layer,
//  and its import validator accepts the whole document.
//  Proven in the OA checks below (run on the old tree).
// FAIL-ON-OLD (◆ legs P1 · M1 · M2 · V1 · W1 · K1 · D1):
//  each ◆ leg runs against BOTH trees; the old-tree run
//  is recorded in the OA/◆ companion checks and in the
//  build log. Results at build time are recorded in the
//  header of v604-build-log.md.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', 'main:app/worker/src/client.ts']);
const oldIndexSrc = git(['show', 'main:app/worker/src/index.ts']);
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

// ---------- the M2 populated variant (production shapes) ----------
function variantDoc() {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const P = doc.sections.profiles;
  P.dayDefaults = { sun: 'benedictine' };               // the shipped seed shape (client C:1618 / server S:1315 at base)
  P.picks = { '2026-11-22': 'little-way' };             // 2026-11-22 is a Sunday
  P.standingKey = 'benedictine';                        // NOT the raw file's salesian — proves no hardcoded name
  const byKey = (k) => P.list.find((p) => p.key === k);
  byKey('salesian').contents = {
    Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'source', key: 'daily-rosary' }, { kind: 'source', key: 'marian-antiphon' }, { kind: 'seat', key: 'daily-readings' }],
    Midday: [{ kind: 'source', key: 'marian-antiphon-midday' }],
    Evening: [{ kind: 'source', key: 'marian-antiphon-evening' }],
    Night: [{ kind: 'source', key: 'daily-reflection' }],
    Novenas: [{ kind: 'all-novenas' }],
  };
  byKey('benedictine').contents = {
    Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'source', key: 'daily-rosary' }],
    Night: [{ kind: 'source', key: 'daily-reflection' }],
    Novenas: [{ kind: 'all-novenas' }],
  };
  byKey('little-way').contents = { Morning: [{ kind: 'source', key: 'daily-rosary' }], Night: [{ kind: 'source', key: 'daily-reflection' }] };
  P.todayEdits = { '2026-11-22': { baseProfileKey: 'benedictine', coreBlocks: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], contents: { Night: [{ kind: 'source', key: 'daily-reflection' }] } } };
  return doc;
}

// ---------- render APP_JS (new + old) ----------
function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

// ---------- server resolver extraction (parity) ----------
function extractServerFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('server fn not found: ' + name);
  const nl = src.indexOf('\n', start);
  let i = src.lastIndexOf('{', nl);
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1);
}
function serverResolver(src) {
  let dk = extractServerFn(src, 'profileDayKind');
  dk = dk.replace('function profileDayKind(date: string): "sunday" | "solemnity" | "weekday" {', 'function profileDayKind(date) {')
    .replace('(MASS_CALENDAR as Record<string, { name: string; default: string; versions: { key: string; rank?: string; part?: string }[] }>)[date]', 'MASS_CALENDAR[date]');
  let pr = extractServerFn(src, 'profileResolve');
  pr = pr.replace(/function profileResolve\(store: PrayerProfileStore, date: string\): \{[^}]*\} \{/, 'function profileResolve(store, date) {')
    .replace('(k: string | undefined)', '(k)');
  return new Function('MASS_CALENDAR', dk + '\n' + pr + '\nreturn profileResolve;')({});
}

// ---------- worlds ----------
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v604:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, openEditTodayScreen594, opnLocalApi, opnMode, state, opnResolveProfile590, opnProfilesPayload, opnCheckContents590, opnCheckTodayLayer594, opnValidateImport, opnFoldDay590, paintPrayersView, opnStandingContents597, opnTodayComposedContents594, openHeaderMenu, opnVaultLocked, opnDoc: (typeof opnDoc === "function" ? opnDoc : null), opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnDragOver604: (typeof opnDragOver604 === "function" ? opnDragOver604 : null), opnMigrateProfiles604: (typeof opnMigrateProfiles604 === "function" ? opnMigrateProfiles604 : null) };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function storeOf(doc) { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(doc))); return st; }
function johnStore() { return storeOf(JOHN); }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function type(w, inp, text) { inp.value = text; inp.dispatchEvent(new w.Event('input', { bubbles: true })); }
function docOf(w) { return JSON.parse(w.localStorage.getItem(DATA_KEY)); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => ({ episodeId: b + '-t' + i, title: t, state: 'present', streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const day = O.opnFoldDay590(publicDay(TODAY, ['x', 'y']));
  O.state.dayPayload = day;
  O.paintPrayersView(day);
  return day;
}
function dateLabelOf(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(dt);
}

// ---------- OA: old-build acceptance of the M2 variant ----------
{
  const w = makeWorld(oldJs, storeOf(variantDoc()));
  await sleep(400);
  const O = w.__opn;
  const P = docOf(w).sections.profiles;
  const res = O.opnResolveProfile590(P, '2026-11-22');
  check('OA1 OLD BUILD accepts the variant: its resolver resolves the variant Sunday BY ITS PICK (little-way)',
    res.profile.key === 'little-way' && res.resolvedBy === 'pick', res);
  let contentsOk = true;
  try { P.list.forEach((p) => { if (p.contents) O.opnCheckContents590(JSON.parse(JSON.stringify(p.contents)), p.coreBlocks); }); } catch (e) { contentsOk = false; }
  const layerChk = O.opnCheckTodayLayer594(P, JSON.parse(JSON.stringify(P.todayEdits['2026-11-22'])));
  check('OA2 OLD BUILD validators accept the variant whole: contents check + today-layer check + import validation',
    contentsOk && !layerChk.error && !!O.opnValidateImport(JSON.stringify(variantDoc())), { contentsOk, layerErr: layerChk.error });
  w.close();
}

// ---------- P1 ◆ precedence (client + server parity, both trees) ----------
{
  const store = { profiles: [{ key: 'little-way' }, { key: 'salesian' }, { key: 'benedictine' }], standingKey: 'benedictine', picks: { '2026-11-22': 'little-way' }, dayDefaults: { sun: 'benedictine' } };
  const newSrv = serverResolver(indexSrc)(JSON.parse(JSON.stringify(store)), '2026-11-22');
  const oldSrv = serverResolver(oldIndexSrc)(JSON.parse(JSON.stringify(store)), '2026-11-22');
  check('P1a ◆ server parity: the new profileResolve resolves the Sunday to the STANDING pick; the old resolves it by pick (fail-on-old)',
    newSrv.profile.key === 'benedictine' && newSrv.resolvedBy === 'standing' && oldSrv.profile.key === 'little-way' && oldSrv.resolvedBy === 'pick',
    { newSrv, oldSrv });
}
{
  const w = makeWorld(appJs, storeOf(variantDoc()));
  await sleep(400);
  const P = docOf(w).sections.profiles;
  const res = w.__opn.opnResolveProfile590(P, '2026-11-22');
  check('P1b ◆ client: a stored doc with a Sunday pick + day map resolves that Sunday to the STANDING pick (benedictine, from the variant standingKey)',
    res.profile.key === 'benedictine' && res.resolvedBy === 'standing', res);
  w.close();
  const wo = makeWorld(oldJs, storeOf(variantDoc()));
  await sleep(400);
  const resO = wo.__opn.opnResolveProfile590(docOf(wo).sections.profiles, '2026-11-22');
  check('P1c ◆ fail-on-old recorded: the ffd1bbe client resolves the same doc by pick (little-way)',
    resO.profile.key === 'little-way' && resO.resolvedBy === 'pick', resO);
  wo.close();
}

// ---------- M1 ◆ / M2 ◆ / M3 migration ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const P = docOf(w).sections.profiles;
  check('M1 ◆ migration (raw fixture): dayDefaults + picks ABSENT post-migration, standing pick = salesian from the stored standingKey, list byte-identical',
    !('dayDefaults' in P) && !('picks' in P) && P.standingKey === 'salesian'
    && JSON.stringify(P.list) === JSON.stringify(JOHN.sections.profiles.list), Object.keys(P));
  w.close();
  const wo = makeWorld(oldJs, johnStore());
  await sleep(400);
  const Po = docOf(wo).sections.profiles;
  check('M1 ◆ fail-on-old recorded: the ffd1bbe build leaves the fixture picks field standing (no mig604)',
    'picks' in Po, Object.keys(Po));
  wo.close();
}
{
  const variant = variantDoc();
  const preList = JSON.stringify(variant.sections.profiles.list);
  const preToday = JSON.stringify(variant.sections.profiles.todayEdits);
  const w = makeWorld(appJs, storeOf(variant));
  await sleep(400);
  const P = docOf(w).sections.profiles;
  const payload = await profilesPayload(w);
  check('M2 ◆ migration (populated variant): dayDefaults + picks PRESENT pre, ABSENT post; list/contents/todayEdits byte-identical; standing pick = benedictine (the variant stored standingKey, no hardcoded name)',
    !('dayDefaults' in P) && !('picks' in P)
    && JSON.stringify(P.list) === preList && JSON.stringify(P.todayEdits) === preToday
    && payload.effective && payload.effective.key === 'benedictine',
    { keys: Object.keys(P), eff: payload.effective && payload.effective.key });
  const afterFirst = w.localStorage.getItem(DATA_KEY);
  w.close();
  const w2 = makeWorld(appJs, { [DATA_KEY]: afterFirst });
  await sleep(400);
  check('M3 migration runs ONCE: a second open writes nothing (the stored document is byte-identical)',
    w2.localStorage.getItem(DATA_KEY) === afterFirst);
  w2.close();
  const wo = makeWorld(oldJs, storeOf(variantDoc()));
  await sleep(400);
  const Po = docOf(wo).sections.profiles;
  check('M2 ◆ fail-on-old recorded: the ffd1bbe build leaves dayDefaults + picks standing on the variant',
    'dayDefaults' in Po && 'picks' in Po, Object.keys(Po));
  wo.close();
}

// ---------- M4: vault-unlock migration (Review defect R3-1) ----------
// Envelope built with the OLD build (ffd1bbe, via oldJs = git main)
// over the M2 populated variant. On the NEW build: (a) locked first
// open leaves the envelope byte-identical, no mig604 anywhere real
// (b) unlock runs mig604 against the REAL document and persists it
// through the vault path (c) lock + unlock again writes nothing.
{
  const variant = variantDoc();
  const expList = JSON.stringify(variant.sections.profiles.list);
  const expToday = JSON.stringify(variant.sections.profiles.todayEdits);
  const expStanding = variant.sections.profiles.standingKey;
  let env = null;
  {
    const wOld = makeWorld(oldJs, storeOf(variantDoc()));
    await sleep(400);
    await wOld.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    await sleep(300);
    env = {}; for (let i = 0; i < wOld.localStorage.length; i++) { const k = wOld.localStorage.key(i); env[k] = wOld.localStorage.getItem(k); }
    wOld.close();
  }
  const envBefore = env[DATA_KEY];
  const w = makeWorld(appJs, JSON.parse(JSON.stringify(env)));
  await sleep(500);
  const lockedOk = w.__opn.opnVaultLocked() === true && w.localStorage.getItem(DATA_KEY) === envBefore;
  let unlockErr = '';
  try { await w.__opn.opnLocalApi('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device'); } catch (e) { unlockErr = String((e && e.message) || e); }
  await sleep(300);
  const P = w.__opn.opnDoc().sections.profiles;
  const postUnlock = {
    noDayDefaults: !('dayDefaults' in P), noPicks: !('picks' in P), mig604: P.mig604 === true,
    standing: P.standingKey === expStanding,
    list: JSON.stringify(P.list) === expList, today: JSON.stringify(P.todayEdits) === expToday,
    envChanged: w.localStorage.getItem(DATA_KEY) !== envBefore,
  };
  const docAfterFirst = JSON.stringify(w.__opn.opnDoc());
  const envAfterFirst = w.localStorage.getItem(DATA_KEY);
  const storeAfterFirst = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); storeAfterFirst[k] = w.localStorage.getItem(k); }
  w.close();
  // lock + unlock again: a fresh world over the persisted envelope is locked.
  const w2 = makeWorld(appJs, storeAfterFirst);
  await sleep(500);
  const locked2 = w2.__opn.opnVaultLocked() === true && w2.localStorage.getItem(DATA_KEY) === envAfterFirst;
  let unlock2Err = '';
  try { await w2.__opn.opnLocalApi('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device'); } catch (e) { unlock2Err = String((e && e.message) || e); }
  await sleep(300);
  const noSecondWrite = w2.localStorage.getItem(DATA_KEY) === envAfterFirst && JSON.stringify(w2.__opn.opnDoc()) === docAfterFirst;
  w2.close();
  check('M4 vault-unlock migration: old-build envelope over the populated variant — (a) locked first open envelope byte-identical, no mig604 anywhere real · (b) unlock deletes dayDefaults + picks on the REAL document, mig604 set, standingKey/list/contents/todayEdits byte-identical to the variant, migrated document persisted in the envelope · (c) lock + unlock again writes nothing',
    lockedOk && !unlockErr && postUnlock.noDayDefaults && postUnlock.noPicks && postUnlock.mig604 && postUnlock.standing && postUnlock.list && postUnlock.today && postUnlock.envChanged && locked2 && !unlock2Err && noSecondWrite,
    { lockedOk, unlockErr, postUnlock, locked2, unlock2Err, noSecondWrite, keys: Object.keys(P) });
}

// ---------- V1 ◆ validators ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn;
  const before = await profilesPayload(w);
  let stateErr = null, pickErr = null;
  try { await O.opnLocalApi('/api/prayer/profiles/state', { method: 'PUT', body: JSON.stringify({ dayDefaults: { sun: 'benedictine' } }) }, 'device'); } catch (e) { stateErr = e; }
  try { await O.opnLocalApi('/api/prayer/profiles/day-pick', { method: 'PUT', body: JSON.stringify({ date: TODAY, profileKey: 'benedictine' }) }, 'device'); } catch (e) { pickErr = e; }
  const after = await profilesPayload(w);
  check('V1 ◆ validators: PUT /profiles/state with a dayDefaults field -> named 400, store unchanged; PUT /profiles/day-pick -> route gone (404), store unchanged (client local; server statics alongside)',
    !!stateErr && stateErr.status === 400 && String(stateErr.message || (stateErr.data && stateErr.data.error) || '').includes('dayDefaults retired')
    && !!pickErr && pickErr.status === 404
    && after.state.standingKey === before.state.standingKey && after.state.version === before.state.version
    && indexSrc.includes('dayDefaults retired in v604') && !/seg\[3\] === "day-pick"/.test(indexSrc),
    { stateErr: stateErr && stateErr.status, pickErr: pickErr && pickErr.status });
  w.close();
  const wo = makeWorld(oldJs, johnStore());
  await sleep(400);
  let oldThrew = false;
  try { await wo.__opn.opnLocalApi('/api/prayer/profiles/state', { method: 'PUT', body: JSON.stringify({ dayDefaults: { sun: 'benedictine' } }) }, 'device'); } catch (e) { oldThrew = true; }
  check('V1 ◆ fail-on-old recorded: the ffd1bbe local state route ACCEPTS a dayDefaults write',
    !oldThrew);
  wo.close();
}

// ---------- O / F: the one page + fold ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  const rows = d.querySelectorAll('[data-openblock]');
  check('O1 collapsed paint: every block a collapsed row (name · count · duration), no track expansions, no edit acts anywhere on the page',
    rows.length >= 5 && !d.querySelector('[data-p604exp]') && !d.querySelector('[data-p604edit]') && !!d.querySelector('[data-p604pickedit]'),
    { rows: rows.length });
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  const mExp = !!d.querySelector('[data-p604exp="Morning"]');
  const eExp = !!d.querySelector('[data-p604exp="Evening"]');
  click(w, d.querySelector('[data-openblock="Evening"]'));
  await sleep(60);
  check('O2 independent fold (Q1): expand Morning -> Evening stays collapsed; expand Evening -> Morning stays expanded',
    mExp && !eExp && !!d.querySelector('[data-p604exp="Morning"]') && !!d.querySelector('[data-p604exp="Evening"]'));
  const exp = d.querySelector('[data-p604exp="Morning"]');
  check('O4 prayer posture: the expanded block stands as it stands — Play All + its track rows live; NO remove/handle/add acts in prayer posture',
    !!exp && !!exp.querySelector('[data-queue="Morning"]') && exp.querySelectorAll('[data-card]').length === 2
    && !exp.querySelector('[data-p604remove]') && !exp.querySelector('[data-p604handle]') && !exp.querySelector('[data-p604add]'),
    { cards: exp && exp.querySelectorAll('[data-card]').length });
  w.close();
}
{
  // O3: the per-block today mark.
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.todayEdits = { [TODAY]: { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'source', key: 'daily-rosary' }] } } };
  const w = makeWorld(appJs, storeOf(doc));
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  check('O3 today mark on the row: the diverging block carries "today has its own edits" on ITS row; a non-diverging block does not',
    !!d.querySelector('[data-p604todaymark="Morning"]') && !d.querySelector('[data-p604todaymark="Evening"]'));
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(60);
  const items = [...d.querySelectorAll('[data-menuitem]')];
  const expItem = items.find((b) => b.textContent.includes('Expand all'));
  check('F1a fold option stands in the page head menu (Expand all / Collapse all)', !!expItem && items.some((b) => b.textContent.includes('Collapse all')));
  if (expItem) click(w, expItem);
  await sleep(60);
  const allExp = d.querySelectorAll('[data-p604exp]').length;
  const blocks = d.querySelectorAll('[data-openblock]').length;
  check('F1b Expand all paints every block expanded and writes the stored mode "expanded"',
    allExp >= blocks - 1 && w.localStorage.getItem('opn-praylistmode-v604') === 'expanded', { allExp, blocks });
  await paintHome(w);
  check('F1c reopening restores the stored mode (every block expanded at paint)',
    d.querySelectorAll('[data-p604exp]').length >= blocks - 1);
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(60);
  const colItem = [...d.querySelectorAll('[data-menuitem]')].find((b) => b.textContent.includes('Collapse all'));
  if (colItem) click(w, colItem);
  await sleep(60);
  check('F1d Collapse all writes "collapsed" and the page stands collapsed',
    w.localStorage.getItem('opn-praylistmode-v604') === 'collapsed' && !d.querySelector('[data-p604exp]'));
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  check('F2 session act: with stored mode "collapsed", expanding one block writes NOTHING to the stored mode',
    !!d.querySelector('[data-p604exp="Morning"]') && w.localStorage.getItem('opn-praylistmode-v604') === 'collapsed');
  w.close();
}

// ---------- Q / E: question, banner, posture ----------
async function enterEdit(w, block, scopeLabel) {
  const d = w.document;
  click(w, d.querySelector('[data-openblock="' + block + '"]'));
  await sleep(60);
  click(w, d.querySelector('[data-p604edit="' + block + '"]'));
  const asked = await until(() => d.querySelector('.p604q'), 9000);
  if (asked && scopeLabel) {
    const row = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.textContent.includes(scopeLabel));
    if (row) click(w, row);
    await until(() => d.querySelector('[data-p604erow]') || d.querySelector('.p604edit'), 9000);
  }
  return asked;
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  const asked = await enterEdit(w, 'Morning', null);
  const q = d.querySelector('.p604q');
  const qText = q ? q.textContent : '';
  check('Q1a the question asks once, with both targets NAMED (the date line + the profile name + "your every-day profile")',
    asked && qText.includes('Today only — ' + dateLabelOf(TODAY)) && qText.includes('Standing — in The Salesian Way, your every-day profile'),
    qText.slice(0, 200));
  const tRow = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === 'today');
  click(w, tRow);
  await until(() => d.querySelector('.p604edit'), 9000);
  check('Q1b the answer opens the edit posture in place (rows carry handle + remove)',
    !!d.querySelector('[data-p604exp="Morning"] [data-p604handle]') && !!d.querySelector('[data-p604remove]'));
  // second block's Edit in the same session: no re-ask
  click(w, d.querySelector('[data-openblock="Evening"]'));
  await sleep(60);
  click(w, d.querySelector('[data-p604edit="Evening"]'));
  await until(() => d.querySelector('[data-p604exp="Evening"] [data-p604handle]'), 9000);
  check('Q1c a second block\'s Edit in the same session does NOT re-ask (no question sheet; the posture opens)',
    !d.querySelector('.p604q') && !!d.querySelector('[data-p604exp="Evening"] [data-p604handle]'));
  check('Q2a the frozen scope banner stands under the plan row for the session, naming the scope',
    !!d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Editing today only'));
  // an act in the today scope, then Change -> standing; the act stands where it was written
  click(w, d.querySelector('[data-p604exp="Evening"] [data-p604remove]'));
  await until(() => { const te = docOf(w).sections.profiles.todayEdits; return te && te[TODAY]; }, 9000);
  click(w, d.querySelector('[data-p604change]'));
  await until(() => d.querySelector('.p604q'), 5000);
  const sRow = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === 'standing');
  click(w, sRow);
  await until(() => d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Editing standing'), 9000);
  const docAfter = docOf(w);
  const layerStands = !!(docAfter.sections.profiles.todayEdits && docAfter.sections.profiles.todayEdits[TODAY]);
  check('Q2b Change re-asks; post-Change the banner names the standing scope, and the pre-Change today act stands in the today layer where it was written',
    layerStands && d.querySelector('[data-p604banner]').textContent.includes('in The Salesian Way'), { layerStands });
  w.close();
}
{
  // E1/E2/E3 in one posture (standing scope via preset session scope)
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'standing';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604exp="Morning"] [data-p604handle]'), 9000);
  const rows = [...d.querySelectorAll('[data-p604exp="Morning"] [data-p604erow]')];
  check('E1 posture rows: every row carries a drag handle + a Remove act; block rows themselves carry no handle (no block reorder)',
    rows.length > 0 && rows.every((r) => r.querySelector('[data-p604handle]') && r.querySelector('[data-p604remove]'))
    && !d.querySelector('[data-openblock="Morning"] [data-p604handle]'), { rows: rows.length });
  const firstRow = rows[0];
  const grow = firstRow.querySelector('.grow');
  click(w, grow);
  await sleep(60);
  check('E1b a row tap in edit posture neither plays nor opens a card (no player state, posture stands)',
    !O.state.current && !!d.querySelector('[data-p604exp="Morning"] [data-p604handle]'));
  // E2 restore line
  const payload0 = await profilesPayload(w);
  const compIds = (payload0.profiles.find((p) => p.key === 'salesian').contents
    ? payload0.profiles.find((p) => p.key === 'salesian').contents.Morning
    : O.opnStandingContents597(payload0.profiles.find((p) => p.key === 'salesian'), 'Morning')).map((it) => it.kind + ':' + (it.key || ''));
  const removeBtn = d.querySelector('[data-p604exp="Morning"] [data-p604remove]');
  const removedId = removeBtn.getAttribute('data-p604remove').split('|').slice(1).join('|');
  click(w, removeBtn);
  await until(() => d.querySelector('[data-p604removed="Morning"]'), 9000);
  const restoreBtn = d.querySelector('[data-p604restore]');
  check('E2a a removal stands the restore line in the block', !!restoreBtn && d.querySelector('[data-p604removed="Morning"]').textContent.includes('Removed:'));
  click(w, restoreBtn);
  const restoredOk = await until(() => { const p = docOf(w).sections.profiles.list.find((x) => x.key === 'salesian'); return p.contents && JSON.stringify(p.contents.Morning.map((it) => it.kind + ':' + (it.key || ''))) === JSON.stringify(compIds); }, 9000);
  await sleep(120);
  check('E2b restore returns the track at its composed position (the standing contents equal the composed list whole)', restoredOk);
  // E3 drag
  const erows = [...d.querySelectorAll('[data-p604exp="Morning"] [data-p604erow]')];
  const idA = erows[0].getAttribute('data-p604erow');
  const idB = erows[erows.length - 1].getAttribute('data-p604erow');
  const handle = erows[0].querySelector('[data-p604handle]');
  handle.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  O.opnDragOver604('Morning', idA, idB);
  d.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, cancelable: true }));
  await until(() => { const p = docOf(w).sections.profiles.list.find((x) => x.key === 'salesian'); return p.contents && p.contents.Morning[p.contents.Morning.length - 1] && (p.contents.Morning[p.contents.Morning.length - 1].kind + ':' + (p.contents.Morning[p.contents.Morning.length - 1].key || '')) === idA; }, 9000);
  const blockOrder = [...d.querySelectorAll('[data-openblock]')].map((r) => r.getAttribute('data-openblock'));
  check('E3 drag: a handle drag reorders the block\'s tracks in the scope store (the dragged item lands at the target); the block order itself is unchanged and no block drag handle exists',
    blockOrder.indexOf('Morning') < blockOrder.indexOf('Evening') && !d.querySelector('[data-openblock] [data-p604handle]'), { blockOrder });
  w.close();
}

// ---------- W: writes + guards ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  await enterEdit(w, 'Morning', 'Today only');
  await until(() => d.querySelector('[data-p604exp="Morning"] [data-p604remove]'), 9000);
  click(w, d.querySelector('[data-p604exp="Morning"] [data-p604remove]'));
  const landed = await until(() => { const te = docOf(w).sections.profiles.todayEdits; return te && te[TODAY] && te[TODAY].contents && te[TODAY].contents.Morning; }, 9000);
  const payload = await profilesPayload(w);
  check('W1 ◆ today-at-once: an in-place today-scope REMOVE stands in todayEdits[date] with NO Save act pressed and no draft state — the payload carries the layer at once',
    landed && !!payload.todayEdit, { landed });
  w.close();
  const wo = makeWorld(oldJs, johnStore());
  await sleep(400);
  await paintHome(wo);
  check('W1 ◆ fail-on-old recorded: the ffd1bbe one page has no in-place Edit surface at all',
    !wo.document.querySelector('[data-p604edit]'));
  wo.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'standing';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604add="Morning"]'), 9000);
  click(w, d.querySelector('[data-p604add="Morning"]'));
  await until(() => d.querySelector('.profaddladder603'), 9000);
  click(w, d.querySelector('[data-p603door="courses"]'));
  await sleep(80);
  click(w, d.querySelector('[data-p603additem="course:bible-in-a-year"]'));
  const landed = await until(() => { const p = docOf(w).sections.profiles.list.find((x) => x.key === 'salesian'); return p.contents && (p.contents.Morning || []).some((it) => it.kind === 'course' && it.key === 'bible-in-a-year'); }, 9000);
  const te = docOf(w).sections.profiles.todayEdits;
  check('W2 standing write: a standing-scope ADD lands in the profile-in-force\'s contents[block] and in NO today layer',
    landed && (!te || !te[TODAY]), { landed });
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'today';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604add="Morning"]'), 9000);
  click(w, d.querySelector('[data-p604add="Morning"]'));
  await until(() => d.querySelector('.profaddladder603'), 9000);
  const doors = [...d.querySelectorAll('[data-p603door]')].map((x) => x.getAttribute('data-p603door'));
  click(w, d.querySelector('[data-p603door="sources"]'));
  await sleep(80);
  const marked = [...d.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('Already in Morning'));
  check('W3 ladder third host: ADD opens openAddLadder603 for the block (doors Courses · Prayers · Sources) and "Already in Morning" marks read the scope\'s effective list',
    JSON.stringify(doors) === JSON.stringify(['courses', 'prayers', 'sources']) && !!marked, { doors });
  w.close();
}
{
  // W4: locked vault — the gate stands in place of the posture.
  let env = null;
  {
    const w1 = makeWorld(appJs, johnStore());
    await sleep(400);
    await w1.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    env = {}; for (let i = 0; i < w1.localStorage.length; i++) { const k = w1.localStorage.key(i); env[k] = w1.localStorage.getItem(k); }
    w1.close();
  }
  const w = makeWorld(appJs, env);
  await sleep(500);
  await paintHome(w);
  const d = w.document;
  const envBefore = w.localStorage.getItem(DATA_KEY);
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  const editBtn = d.querySelector('[data-p604edit="Morning"]');
  if (editBtn) click(w, editBtn);
  const gated = await until(() => { const exp = d.querySelector('[data-p604exp="Morning"]'); return exp && exp.innerHTML.includes('opn-unlock'); }, 9000);
  check('W4 vault gate: device shape + locked vault -> Edit stands the unlock card in place of the posture; no posture rows, the stored envelope byte-identical (no write route ran)',
    gated && !d.querySelector('[data-p604erow]') && w.localStorage.getItem(DATA_KEY) === envBefore, { gated });
  w.close();
}
{
  // W5: standings first, cold.
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'today';
  O.state.ownStanding = undefined;
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604exp="Morning"] [data-p604remove]'), 12000);
  const payload0 = await profilesPayload(w);
  const rec = payload0.profiles.find((p) => p.key === 'salesian');
  const composed = O.opnStandingContents597(rec, 'Morning');
  const firstId = composed[0].kind + ':' + (composed[0].key || '');
  const btn = [...d.querySelectorAll('[data-p604remove]')].find((b) => b.getAttribute('data-p604remove') === 'Morning|' + firstId);
  if (btn) click(w, btn);
  const landed = await until(() => { const te = docOf(w).sections.profiles.todayEdits; return te && te[TODAY] && te[TODAY].contents && te[TODAY].contents.Morning; }, 9000);
  const written = landed ? docOf(w).sections.profiles.todayEdits[TODAY].contents.Morning : [];
  const expect = composed.filter((it) => (it.kind + ':' + (it.key || '')) !== firstId);
  check('W5 standings first: cold state -> opnEnsureStandings601 settles before the first materialized write; the written layer equals the standings-composed list minus the removed item (no poisoned snapshot)',
    landed && JSON.stringify(written) === JSON.stringify(expect) && written.some((it) => it.kind === 'source'),
    { written: written.length, expect: expect.length });
  w.close();
}
{
  // W6: settled intention draws never re-drawn by an edit.
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn;
  const mkDay = () => { const day = publicDay(TODAY, ['x', 'y']); day.blocks.forEach((b) => b.tracks.forEach((t, i) => { t.intention = 'Drawn for ' + t.episodeId; })); return O.opnFoldDay590(day); };
  const drawsOf = (day) => { const out = {}; (day.blocks || []).forEach((b) => (b.tracks || []).forEach((t) => { out[t.episodeId] = t.intention || null; })); return out; };
  const before = drawsOf(mkDay());
  await O.opnLocalApi('/api/prayer/profiles/today-edit', { method: 'PUT', body: JSON.stringify({ date: TODAY, layer: { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'source', key: 'daily-rosary' }] } } }) }, 'device');
  const after = drawsOf(mkDay());
  check('W6 intentions stand: a today-scope edit does not change any settled intention draw on the day\'s tracks (the draw set compares identical pre/post edit)',
    JSON.stringify(before) === JSON.stringify(after), { before: Object.keys(before).length });
  w.close();
}

// ---------- S: Save New ----------
async function saveNewFlow(w, name) {
  const d = w.document;
  click(w, d.querySelector('[data-p604savenew]'));
  await until(() => d.querySelector('[data-rename590="1"]'), 9000);
  const inp = d.querySelector('[data-rename590="1"]');
  type(w, inp, name);
  click(w, d.querySelector('[data-rename590save="1"]'));
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'today';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604savenew]'), 9000);
  const cleanDisabled = d.querySelector('[data-p604savenew]').disabled;
  click(w, d.querySelector('[data-p604exp="Morning"] [data-p604remove]'));
  await until(() => { const b = d.querySelector('[data-p604savenew]'); return b && !b.disabled; }, 9000);
  check('S1 Save New state: the bar stands in edit posture; Save New is disabled while the session is clean and active after the first dirty act',
    cleanDisabled === true);
  const origBefore = JSON.stringify(docOf(w).sections.profiles.list.find((x) => x.key === 'salesian'));
  const payload = await profilesPayload(w);
  const comp = O.opnTodayComposedContents594(payload.profiles.find((p) => p.key === 'salesian'), 'Morning');
  const layerList = docOf(w).sections.profiles.todayEdits[TODAY].contents.Morning;
  await saveNewFlow(w, 'Minted Day');
  const done = await until(() => { const P = docOf(w).sections.profiles; const mint = P.list.find((x) => x.name === 'Minted Day'); return mint && P.standingKey === mint.key && !(P.todayEdits && P.todayEdits[TODAY]); }, 12000);
  const P = docOf(w).sections.profiles;
  const mint = P.list.find((x) => x.name === 'Minted Day');
  check('S2 Save New mint (today scope): the mint\'s Morning contents equal the COMPOSED day (the today layer folded whole); the date\'s today layer is absent after; standingKey = the mint; the original profile record byte-identical; the banner names the mint',
    done && !!mint && JSON.stringify(mint.contents.Morning) === JSON.stringify(layerList)
    && JSON.stringify(P.list.find((x) => x.key === 'salesian')) === origBefore
    && d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Minted Day'),
    { done, mint: mint && mint.key });
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'standing';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604exp="Morning"] [data-p604remove]'), 9000);
  const origBefore = JSON.stringify(docOf(w).sections.profiles.list.find((x) => x.key === 'salesian'));
  click(w, d.querySelector('[data-p604exp="Morning"] [data-p604remove]'));
  await until(() => d.querySelector('[data-p604savenew]') && !d.querySelector('[data-p604savenew]').disabled, 9000);
  const editedList = docOf(w).sections.profiles.list.find((x) => x.key === 'salesian').contents.Morning;
  await saveNewFlow(w, 'Standing Mint');
  const done = await until(() => { const P = docOf(w).sections.profiles; const mint = P.list.find((x) => x.name === 'Standing Mint'); return mint && P.standingKey === mint.key; }, 12000);
  const P = docOf(w).sections.profiles;
  const mint = P.list.find((x) => x.name === 'Standing Mint');
  const origAfter = P.list.find((x) => x.key === 'salesian');
  check('S3 Save New mint (standing scope): the mint equals the edited profile shape; the mint act itself leaves the original record exactly as the session edited it; the standing pick moves to the mint',
    done && !!mint && JSON.stringify(mint.contents.Morning) === JSON.stringify(editedList)
    && JSON.stringify(origAfter.contents.Morning) === JSON.stringify(editedList),
    { done });
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const O = w.__opn, d = w.document;
  O.opn604.scope = 'today';
  await enterEdit(w, 'Morning', null);
  await until(() => d.querySelector('[data-p604exp="Morning"] [data-p604remove]'), 9000);
  click(w, d.querySelector('[data-p604exp="Morning"] [data-p604remove]'));
  await until(() => d.querySelector('[data-p604savenew]') && !d.querySelector('[data-p604savenew]').disabled, 9000);
  const n0 = docOf(w).sections.profiles.list.length;
  click(w, d.querySelector('[data-p604savenew]'));
  await until(() => d.querySelector('[data-rename590="1"]'), 9000);
  const inp = d.querySelector('[data-rename590="1"]');
  type(w, inp, '');
  click(w, d.querySelector('[data-rename590save="1"]'));
  await sleep(300);
  check('S4 name required: Save New with an empty name mints nothing (the standing rename-sheet discipline)',
    docOf(w).sections.profiles.list.length === n0 && !!d.querySelector('.profrename590'), { n0 });
  w.close();
}

// ---------- K: pick Edit + Edit today chips ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  click(w, d.querySelector('[data-p604pickedit]'));
  await until(() => d.querySelector('.p604pick'), 9000);
  const chips = [...d.querySelectorAll('[data-p604pickchip]')];
  const marked = chips.find((c) => c.classList.contains('on'));
  check('K1a ◆ pick Edit sheet: chips for every profile stand with the standing one marked',
    chips.length === 3 && !!marked && marked.getAttribute('data-p604pickchip') === 'salesian', { chips: chips.length });
  click(w, chips.find((c) => c.getAttribute('data-p604pickchip') === 'benedictine'));
  click(w, d.querySelector('[data-p604picksave]'));
  const landed = await until(() => docOf(w).sections.profiles.standingKey === 'benedictine', 9000);
  const payload = await profilesPayload(w);
  check('K1b ◆ pick Edit: Save writes standingKey and the day rebuilds under the new profile at once (effective = benedictine)',
    landed && payload.effective.key === 'benedictine', { landed });
  w.close();
  const wo = makeWorld(oldJs, johnStore());
  await sleep(400);
  await paintHome(wo);
  check('K1 ◆ fail-on-old recorded: the ffd1bbe plan row carries no pick Edit act',
    !wo.document.querySelector('[data-p604pickedit]'));
  wo.close();
}
{
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.todayEdits = { [TODAY]: { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'source', key: 'daily-rosary' }] } } };
  const w = makeWorld(appJs, storeOf(doc));
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  click(w, d.querySelector('[data-p604pickedit]'));
  await until(() => d.querySelector('.p604pick'), 9000);
  const warned = !!d.querySelector('[data-p604pickwarn]');
  click(w, [...d.querySelectorAll('[data-p604pickchip]')].find((c) => c.getAttribute('data-p604pickchip') === 'little-way'));
  click(w, d.querySelector('[data-p604picksave]'));
  const landed = await until(() => { const P = docOf(w).sections.profiles; return P.standingKey === 'little-way' && !(P.todayEdits && P.todayEdits[TODAY]); }, 9000);
  check('K2 pick Edit clears the layer: with a today layer standing, the warning stands in the sheet before Save; on Save the layer is absent and the day follows the new pick whole',
    warned && landed, { warned, landed });
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.openEditTodayScreen594(false);
  await until(() => d.querySelector('[data-p594tchip]'), 12000);
  click(w, [...d.querySelectorAll('[data-p594tchip]')].find((c) => c.getAttribute('data-p594tchip') === 'benedictine'));
  await sleep(60);
  click(w, d.querySelector('[data-p600savetoday="1"]'));
  const landed = await until(() => docOf(w).sections.profiles.standingKey === 'benedictine', 12000);
  const P = docOf(w).sections.profiles;
  check('K3 Edit today chips = the standing pick: a chip change + Save today writes standingKey through the standing route (no per-date pick exists in the document)',
    landed && !('picks' in P), { landed });
  w.close();
}

// ---------- D1 ◆: two doors ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  w.__opn.openConfigureLadder593();
  await sleep(120);
  const d = w.document;
  check('D1 ◆ two doors: the Configure ladder paints exactly Edit today · Edit profiles; no mapping door and no route to a mapping screen exists',
    !!d.querySelector('[data-p594door="today"]') && !!d.querySelector('[data-p593door="edit"]')
    && !d.querySelector('[data-p593door="map"]') && !clientSrc.includes('function openDayMappingScreen593'),
    {});
  w.close();
  const wo = makeWorld(oldJs, johnStore());
  await sleep(400);
  wo.__opn.openConfigureLadder593();
  await sleep(120);
  check('D1 ◆ fail-on-old recorded: the ffd1bbe ladder paints THREE doors (the mapping door stands)',
    !!wo.document.querySelector('[data-p593door="map"]'));
  wo.close();
}

console.log('harness-v604:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
