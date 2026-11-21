// harness-v594p2.mjs — v594 Part 2: the three-door ladder
// (Edit today · Edit profiles · Edit mapping) and the today
// layer (todayEdits).
//
//  T  statics: the ladder's three doors + head line · Edit
//     today stands behind the vault gate · the today-edit
//     route in the shim + the server mirror + migration
//     0045 · the editor decoupling (no day-pick in the chip
//     path, the warning line, no today tag, no head line) ·
//     the plan-row mark · the rendered client parses whole
//     · SW pin unmoved pre-Ship.
//  A  equivalence (the gate): NO layer anywhere = the
//     composition is byte-identical to the pre-Part-2 ship
//     (A1 Salesian weekday · A2 Sunday), in the vm world of
//     harness-v593 (the local layer driven directly).
//  L  the layer at the data level: a block-off layer
//     recomposes the day + stamps the mark · a layer on
//     OTHER dates only leaves today byte-identical · a
//     contents entry materializes only its block · the
//     delete returns the day to the profile whole · past
//     dates prune on the next write · validation refuses
//     bad layers · the divergence definition counts ·
//     export/import round-trips the layer (Settlement 2).
//  R  REAL-DOM legs (jsdom): John's document in a plain
//     world and in a LOCKED-VAULT world (a real envelope
//     through the client's own pin-set path — Part 1's
//     lesson: the plain world alone does not prove the
//     field path). The ladder paints three doors + the
//     head state · Edit today gates, unlocks, and a block
//     switch lands the layer · the pick chip clears the
//     layer with its warning standing · the clear act
//     deletes the layer · the editor's chip fires NO pick.
// Fixtures from production only (Improvement D): John's
// import file (his profiles document). The vm world stubs
// profContentsUniverse590 with a named fixture universe —
// the production function reads the day's standing source
// state, which the vm world does not carry; the R legs run
// the real function in the full client.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 the ladder paints THREE doors (Edit today · Edit profiles · Edit mapping) with the consequence sub-lines',
  clientSrc.includes('data-p594door="today"') && clientSrc.includes('data-p593door="edit"') && clientSrc.includes('data-p593door="map"')
  && clientSrc.includes('changes stand for today only') && clientSrc.includes('changes stand in every day that follows it'));
check('T2 the ladder head states today\u2019s standing whole (Q5=A)',
  clientSrc.includes('data-p594ladderhead="1"') && clientSrc.includes("'Today follows ' + r.effective.name + (edits ? ' · today has its own edits' : '')"));
check('T3 Edit today stands behind the locked-vault gate, on Part 1\u2019s exact pattern',
  clientSrc.includes('function openEditTodayScreen594(fromLadder)')
  && clientSrc.includes('if (!profVaultGate594(body, startLoad, closeScreen)) startLoad();'));
check('T4 the today-edit route stands in the shim with bump() + prune; the pick chips write the standing day-pick route',
  clientSrc.includes("if (p === '/api/prayer/profiles/today-edit')")
  && clientSrc.includes('opnPruneTodayEdits594(P);')
  && clientSrc.includes("profPut('/api/prayer/profiles/day-pick', { date: todayChicago(), profileKey: key })"));
check('T5 the layer model stands: entry + check + apply + divergence helpers; the fold applies after the profile and stamps the mark',
  clientSrc.includes('function opnTodayEntry594(P, date)') && clientSrc.includes('function opnCheckTodayLayer594(P, layer)')
  && clientSrc.includes('function opnApplyTodayLayer594(eff, layer)') && clientSrc.includes('function opnTodayDivergence594(rec, layer)')
  && clientSrc.includes('eff = opnApplyTodayLayer594(eff, tEntry594);') && clientSrc.includes('eff.todayEdits = true'));
check('T6 the editor is decoupled: the chip switch writes no pick and rebuilds no day; the warning line stands; the today tag and the Today-follows head are retired',
  !clientSrc.includes("profPut('/api/prayer/profiles/day-pick', { date: todayChicago(), profileKey: key }).then(function (r) {\n      if (r) res = r;\n      ed = null; edKey = key;")
  && clientSrc.includes('data-p594warn="1">Changes here stand in every day that follows this profile.')
  && !clientSrc.includes('today593') && !clientSrc.includes('data-p591head'));
check('T7 Edit profiles keeps its standing machinery: the switch prompt guards the draft, Save · Save New · Reset · Delete stand',
  clientSrc.includes('function openSwitchPrompt(targetKey)') && clientSrc.includes('function saveProfileDraft(cb)')
  && clientSrc.includes('function doSaveNew()') && clientSrc.includes("profPut('/api/prayer/profiles/reset'") && clientSrc.includes("profPut('/api/prayer/profiles/delete'"));
check('T8 the plan row carries the edits mark on the merged one-row form (v595 stands)',
  clientSrc.includes("resLine + (fold.todayEdits ? ' · today has its own edits' : '')") && clientSrc.includes('function profPlanRowHtml(day)'));
check('T9 the server mirror stands: migration 0045 is newest; the store reads today_edits; the fold applies it; the mirror route validates + writes',
  readdirSync(APP + 'migrations').sort().slice(-1)[0].startsWith('0045')
  && indexSrc.includes('SELECT today_edits FROM prayer_profile_state WHERE id=1')
  && indexSrc.includes('todayLayerDiverges594(profile, layer)') && indexSrc.includes('fold.todayEdits = true')
  && indexSrc.includes('seg[3] === "today-edit"') && indexSrc.includes('UPDATE prayer_profile_state SET today_edits = ?'));
check('T10 Edit today\u2019s words stand: the teaching line · the pick warning · the divergence line · the clear act · the materialize sentence · the badges',
  clientSrc.includes('Changes here stand for today only. To change every day, use Edit profiles.')
  && clientSrc.includes('Changing the pick clears today’s edits.')
  && clientSrc.includes('Today differs from ') && clientSrc.includes('Clear today’s edits — follow the profile whole')
  && clientSrc.includes('Set for today — stands as listed · new prayers added to ')
  && clientSrc.includes('off for today (') && clientSrc.includes('added for today') && clientSrc.includes('Removed for today: '));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T11 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T12 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- vm world (harness-v593 pattern) ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
// The fixture universe for the vm world (see header): the
// standing source/course/seat items per block, in the
// production universe's own shape.
const FIXTURE_UNIVERSE = `
this.profContentsUniverse590 = function (block) {
  if (block === 'Novenas') return [{ kind: 'all-novenas', key: '', label: 'Every active novena' }];
  var items = [
    { kind: 'source', key: 'src-' + block.toLowerCase() + '-a', label: block + ' source A' },
    { kind: 'source', key: 'src-' + block.toLowerCase() + '-b', label: block + ' source B' }
  ];
  if (block === 'Morning') items.push({ kind: 'seat', key: 'daily-readings', label: 'The day\\u2019s readings' });
  ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'summa-in-a-year'].forEach(function (k) { items.push({ kind: 'course', key: k, label: 'Course — ' + k }); });
  return items;
};`;
function makeWorld(store, today) {
  const world = {
    console, URLSearchParams, Promise, Date, JSON, Object, Array, String, Number, Math, Set, Map, Error, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent, Intl,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  vm.createContext(world);
  const opnSlice = slice('var OPN_PLAYBACK_KEY', '/* ---- local per-track intention draws');
  const seedSlice = slice('var OPN_SEED_PROFILES', 'function opnLocalApi');
  const localSlice = slice('function opnLocalApi', 'function api(path, opts)');
  const restoreSlice = slice('function opnCountsOf', 'function opnHasSnapshot');
  vm.runInContext("var OPN_DATA_KEY = 'opn-personal-data-v1';\nthis.todayChicago = function () { return '" + today + "'; };\n" + opnSlice + '\n' + seedSlice + '\n' + localSlice + '\n' + restoreSlice + '\n' + FIXTURE_UNIVERSE + '\n;this.__local = opnLocalApi; this.__scrub = opnScrubDayPayload; this.__payload = opnProfilesPayload; this.__export = opnExportText; this.__restore = opnRestoreFromText; this.__div = opnTodayDivergence594; this.__doc = opnDoc;', world);
  vm.runInContext("this.window = { __OPN_SHAPE__: 'public' }; this.oraInShell = function () { return true; };", world);
  return world;
}
function johnStore() {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const store = {};
  store[DATA_KEY] = JSON.stringify(doc);
  return store;
}
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => ({ episodeId: b + '-t' + i, title: t })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
const compOf = (day) => day.blocks.map((b) => b.block + '|' + (b.tracks || []).map((t) => t.episodeId).join(',')).join(' ; ');
const put = (w) => (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');

// ---------- A: equivalence (the gate) ----------
{
  const w = makeWorld(johnStore(), '2026-11-21'); // a Saturday
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('A1 no layer: Salesian weekday composition byte-identical to the pre-Part-2 ship, no mark',
    compOf(out) === ref && out.profile.key === 'salesian' && out.profile.resolvedBy === 'standing' && !out.profile.todayEdits,
    { got: compOf(out), mark: out.profile && out.profile.todayEdits });
}
{
  const w = makeWorld(johnStore(), '2026-11-22'); // a Sunday
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A2 no layer: Sunday composition byte-identical, resolved day-default, no mark',
    compOf(out) === ref && out.profile.key === 'benedictine' && out.profile.resolvedBy === 'day-default' && !out.profile.todayEdits,
    { got: compOf(out) });
}

// ---------- L: the layer at the data level ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: { baseProfileKey: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening'] } });
  const payload = w.__payload('2026-11-21');
  check('L1 a block-off layer stands in the payload as todayEdit', !!payload.todayEdit && JSON.stringify(payload.todayEdit.coreBlocks) === JSON.stringify(['Morning', 'Midday', 'Evening']), payload.todayEdit);
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x']))));
  check('L2 the day recomposes without Night and the mark stamps',
    compOf(out) === 'Morning|Morning-t0 ; Midday|Midday-t0 ; Evening|Evening-t0 ; Novenas|Novenas-t0 ; Podcasts|' && out.profile.todayEdits === true,
    { got: compOf(out), mark: out.profile && out.profile.todayEdits });
  const prof = payload.profiles.filter((p) => p.key === 'salesian')[0];
  const dv = w.__div(prof, payload.todayEdit);
  check('L3 the divergence definition counts the block-off as exactly one place', dv.length === 1 && dv[0].kind === 'block-off' && dv[0].block === 'Night', dv);
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: null });
  const after = w.__payload('2026-11-21');
  const out2 = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x']))));
  check('L4 the clear (a null layer) deletes the entry and the day follows the profile whole',
    after.todayEdit === null && compOf(out2).includes('Night|Night-t0') && !out2.profile.todayEdits, { te: after.todayEdit });
}
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-22', layer: { baseProfileKey: 'benedictine', coreBlocks: ['Morning'] } });
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('L5 a layer on OTHER dates only leaves today byte-identical, no mark',
    compOf(out) === ref && !out.profile.todayEdits, { got: compOf(out) });
}
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  // a contents entry for Morning only: the composed list
  // (fixture universe) minus one source — materialize-one-
  // block discipline at the fold: Morning's prayer
  // additions + seat gate read the layer list; other
  // blocks' contents fall through to the profile's.
  const prof0 = w.__payload('2026-11-21').profiles.filter((p) => p.key === 'salesian')[0];
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'prayer', key: 'the-angelus' }] } } });
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x']))));
  const angelus = (out.additions || []).filter((a) => a.block === 'Morning' && a.slug === 'the-angelus');
  check('L6 a contents entry materializes only its block: Morning gains the layer\u2019s prayer addition; the profile\u2019s other blocks stand untouched',
    angelus.length === 1 && out.profile.contents.Morning.length === 1 && out.profile.contents.Morning[0].key === 'the-angelus'
    && JSON.stringify(out.profile.coreBlocks) === JSON.stringify(prof0.coreBlocks),
    { adds: out.additions, contents: out.profile.contents && out.profile.contents.Morning });
}
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  let refused = 0;
  try { await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: { baseProfileKey: 'no-such', coreBlocks: ['Morning'] } }); } catch (e) { refused = e.status || 1; }
  try { await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: { baseProfileKey: 'salesian', coreBlocks: ['Brunch'] } }); } catch (e) { refused = (e.status || 1) === 400 ? 400 : refused; }
  check('L7 validation refuses a bad base profile and a bad block with 400s, writing nothing',
    refused === 400 && w.__payload('2026-11-21').todayEdit === null, { refused });
}
{
  const store = johnStore();
  const doc = JSON.parse(store[DATA_KEY]);
  doc.sections.profiles.todayEdits = {
    '2026-11-20': { baseProfileKey: 'salesian', coreBlocks: ['Morning'] },
    '2026-11-21': { baseProfileKey: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening'] },
  };
  store[DATA_KEY] = JSON.stringify(doc);
  const w = makeWorld(store, '2026-11-21');
  const P = put(w);
  await P('/api/prayer/profiles/state', { standingKey: 'salesian' });
  const after = JSON.parse(store[DATA_KEY]).sections.profiles.todayEdits;
  check('L8 past-date entries prune on the next profiles write; today\u2019s stands',
    !!after && !after['2026-11-20'] && !!after['2026-11-21'], after);
}
{
  // Settlement 2 (doc §2.3): the layer rides the v570 file.
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: { baseProfileKey: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening'] } });
  const text = w.__export();
  const parsed = JSON.parse(text);
  check('L9 the export carries the layer inside sections.profiles',
    !!parsed.sections.profiles.todayEdits && !!parsed.sections.profiles.todayEdits['2026-11-21'], Object.keys(parsed.sections.profiles));
  const w2 = makeWorld(johnStore(), '2026-11-21');
  await w2.__restore(text);
  const restored = w2.__doc().sections.profiles.todayEdits;
  check('L10 the restore round-trips the layer byte-identical',
    JSON.stringify(restored) === JSON.stringify(parsed.sections.profiles.todayEdits), restored);
  const bare = JSON.parse(JSON.stringify(JOHN));
  delete bare.sections.profiles.todayEdits;
  const w3 = makeWorld(johnStore(), '2026-11-21');
  let refusedBare = false;
  try { await w3.__restore(JSON.stringify(bare)); } catch (e) { refusedBare = true; }
  check('L11 a file without the section restores with no layer and no refusal',
    !refusedBare && JSON.stringify(w3.__doc().sections.profiles.todayEdits || {}) === '{}', { refusedBare });
}

// ---------- R: real-DOM legs ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available (npm i --no-save jsdom)', false, e.message);
  console.log('harness-v594p2:', ok, 'ok /', bad, 'not ok');
  process.exit(1);
}
const HOOK = '\n;window.__opn = { openConfigureLadder593: openConfigureLadder593, openEditTodayScreen594: openEditTodayScreen594, openProfilesScreen: openProfilesScreen, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, opnVaultCreate: opnVaultCreate, profPlanRowHtml: profPlanRowHtml };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
if (shellStart < 0 || shellEnd < 0) { console.log('not ok - SHELL_HTML template markers'); process.exit(1); }
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function makeDomWorld(store, shape) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', shape || 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  Object.keys(store).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
async function until(fn, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
  return !!(await fn());
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
async function unlockViaPad(w, pin) {
  for (const d of pin.split('')) {
    const b = w.document.querySelector('#opn-unlock-pad [data-pinkey="' + d + '"]');
    if (!b) return false;
    click(w, b);
  }
  await sleep(60);
  const go = w.document.getElementById('opn-unlock-go');
  if (!go || go.disabled) return false;
  click(w, go);
  return true;
}
async function profilesPayload(w) {
  return w.__opn.opnLocalApi('/api/prayer/profiles', {}, w.__opn.opnMode());
}

// R1-R3: the plain-document world — ladder, Edit today, the
// decoupled editor.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeDomWorld(store);
  await sleep(400);
  w.__opn.openConfigureLadder593();
  const doors = await until(() => w.document.querySelectorAll('[data-p594door="today"], [data-p593door]').length === 3);
  const head = w.document.querySelector('[data-p594ladderhead]');
  const headOk = await until(() => head && /Today follows The Salesian Way/.test(head.textContent));
  check('R1 the ladder paints three doors and the head states today\u2019s standing',
    doors && headOk, { doors, head: head && head.textContent });
  click(w, w.document.querySelector('[data-p594door="today"]'));
  const chipsUp = await until(() => !!w.document.querySelector('[data-p594tchip="benedictine"]'));
  check('R2 Edit today opens on the composed day: pick chips stand, the teaching line stands, no pick warning without a layer',
    chipsUp && !!w.document.querySelector('[data-p594tblock="Night"]')
    && w.document.body.textContent.includes('Changes here stand for today only. To change every day, use Edit profiles.')
    && !w.document.querySelector('[data-p594tpickwarn]'), {});
  let landed = null, divLine = '';
  if (chipsUp) {
    click(w, w.document.querySelector('[data-p594tblock="Night"]'));
    const landedOk = await until(async () => {
      const r = await profilesPayload(w);
      return !!(r.todayEdit && JSON.stringify(r.todayEdit.coreBlocks) === JSON.stringify(['Morning', 'Midday', 'Evening']));
    }, 6000);
    landed = landedOk ? await profilesPayload(w) : null;
    await until(() => /in 1 place/.test((w.document.querySelector('[data-p594tdivline]') || {}).textContent || ''), 4000);
    divLine = (w.document.querySelector('[data-p594tdivline]') || {}).textContent || '';
  }
  check('R3 a block switch stands at once: the layer lands with Night off, the divergence line counts 1 place, the badge stands',
    !!landed && /in 1 place/.test(divLine) && w.document.body.textContent.includes('off for today (The Salesian Way stands it on)'),
    { landed: landed && landed.todayEdit, divLine });
  // the pick chip clears the layer (its warning stood first)
  let cleared = false, picked = null, warnStood = !!w.document.querySelector('[data-p594tpickwarn]');
  if (landed) {
    click(w, w.document.querySelector('[data-p594tchip="benedictine"]'));
    cleared = await until(async () => {
      const r = await profilesPayload(w);
      picked = r.effective && r.effective.resolvedBy === 'pick' ? r.effective.key : null;
      return r.todayEdit === null && picked === 'benedictine';
    }, 6000);
  }
  check('R4 the pick warning stood before the tap; the pick lands and the layer is cleared',
    warnStood && cleared && picked === 'benedictine', { warnStood, cleared, picked });
  // the editor, decoupled: a chip tap fires NO pick
  w.__opn.openProfilesScreen(null, { ladder: true });
  const edChips = await until(() => !!w.document.querySelector('[data-p593chip="little-way"]'));
  let noPick = false, edName = '';
  if (edChips) {
    click(w, w.document.querySelector('[data-p593chip="little-way"]'));
    await sleep(700);
    const r = await profilesPayload(w);
    noPick = r.effective.key === 'benedictine' && r.effective.resolvedBy === 'pick';
    const h = w.document.querySelector('.profplan590 .sectionhead');
    edName = h ? h.textContent : '';
  }
  check('R5 Edit profiles is decoupled: its chip switches the editor only — the day\u2019s pick stands untouched; the warning line stands',
    edChips && noPick && /Little Way/.test(edName) && !!w.document.querySelector('[data-p594warn]'),
    { edChips, noPick, edName });
}

// R6: the locked-vault world — Edit today gates, unlocks,
// and a write lands (Part 1's lesson, on the new surface).
let envelopeStore = null;
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeDomWorld(store);
  await sleep(400);
  let made = false;
  try {
    await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    made = await until(() => {
      try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; }
    }, 10000);
  } catch (e) {}
  check('R6 a real vault envelope is created over John\u2019s document through the client\u2019s own pin-set path', made);
  if (made) {
    envelopeStore = {};
    for (let i = 0; i < w.localStorage.length; i++) {
      const k = w.localStorage.key(i);
      envelopeStore[k] = w.localStorage.getItem(k);
    }
  }
}
if (envelopeStore) {
  const w = makeDomWorld(envelopeStore);
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
  check('R7 locked vault: Edit today stands the unlock gate, not the editor',
    gateStood && !w.document.querySelector('[data-p594tblock]'), { gate: gateStood });
  let landed = false;
  if (gateStood && await unlockViaPad(w, '3141')) {
    const up = await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
    if (up) {
      click(w, w.document.querySelector('[data-p594tblock="Night"]'));
      landed = await until(async () => {
        const r = await profilesPayload(w);
        return !!(r.todayEdit && Array.isArray(r.todayEdit.coreBlocks) && r.todayEdit.coreBlocks.indexOf('Night') < 0);
      }, 6000);
    }
  }
  check('R8 after the pad unlock, a block switch on Edit today lands the layer (the field path, proven in the locked world)',
    landed, {});
  // the clear act deletes the layer whole
  let clearedAll = false;
  if (landed) {
    const btnUp = await until(() => !!w.document.querySelector('[data-p594tclear]'), 5000);
    if (btnUp) {
      click(w, w.document.querySelector('[data-p594tclear]'));
      clearedAll = await until(async () => {
        const r = await profilesPayload(w);
        return r.todayEdit === null;
      }, 6000);
    }
  }
  check('R9 the clear act deletes the layer and the day follows the profile whole', clearedAll, {});
}

console.log('harness-v594p2:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
