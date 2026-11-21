// harness-v600.mjs — v600: frozen save acts.
//  (1) Edit profiles: the acts bar stands FROZEN ALWAYS
//      (Save greyed while clean) — reversing v593's Q3=C.
//  (2) Edit today: DRAFT-UNTIL-SAVE with a frozen SAVE
//      TODAY bar — reversing v594 Part 2's Q1=A.
//
//  T  statics: the permanent bar · the Save today bar +
//     the draft machinery · the at-once writes retired
//     from Edit today (every profPut in the screen lives
//     inside saveToday) · the rendered client parses
//     whole · SW pin unmoved pre-Ship.
//  A/L the v594p2 equivalence + layer legs, carried
//     whole: the fold, the payload and the routes are
//     untouched by v600, and these legs prove it (no
//     layer = byte-identical composition; the layer at
//     the data level; export/import round-trip).
//  R  REAL-DOM legs (jsdom), plain + locked-vault
//     worlds over John's document: the profiles bar
//     stands clean and dirty, Save inert when clean, the
//     scroller offset unmoved by the first edit · Edit
//     today writes NOTHING until Save today · Save today
//     writes pick + layer together (the warning painted
//     before) · a profile-whole draft writes no layer ·
//     the Clear act resets the draft without writing ·
//     the close prompt (Discard byte-identical · Stay
//     keeps drafting · Save today writes and closes) ·
//     the ladder head shows no mark while a draft stands
//     unsaved · the both-paths equivalence (a draft-save
//     lands exactly the layer the at-once route write
//     lands) · the locked world: gate → unlock → draft →
//     save lands.
// Fixtures from production only (Improvement D): John's
// import file (his profiles document).
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
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 Edit profiles: the acts bar stands frozen always — never hidden, Save greyed while clean, the line always painted',
  clientSrc.includes('if (barEl) barEl.hidden = false;')
  && clientSrc.includes('if (saveBtn) saveBtn.disabled = !dirty;')
  && clientSrc.includes("dirty ? ed.name + ' · unsaved changes' : 'No unsaved changes'")
  && !clientSrc.includes('if (barEl) barEl.hidden = !dirty;'));
check('T2 Edit today: the frozen Save today bar stands in the editor\u2019s frozen dress',
  clientSrc.includes('data-p600savetoday="1"') && clientSrc.includes('>Save today</button>')
  && clientSrc.includes("frozenT.className = 'proffrozen593 proftodayfrozen600';")
  && clientSrc.includes('data-p600todayline="1"'));
check('T3 the draft machinery stands: saveToday · draftDirtyT · the close prompt in the Q1=B shape',
  clientSrc.includes('function saveToday()') && clientSrc.includes('function draftDirtyT()')
  && clientSrc.includes('function openTodayPrompt600()')
  && clientSrc.includes('data-p600prompt="save"') && clientSrc.includes('data-p600prompt="discard"') && clientSrc.includes('data-p600prompt="stay"')
  && clientSrc.includes('You have unsaved changes for today. Save them before you close?'));
{
  const a = clientSrc.indexOf('function openEditTodayScreen594');
  const b = clientSrc.indexOf('function openProfilesScreen', a);
  const sliceSrc = clientSrc.slice(a, b);
  const puts = sliceSrc.split('profPut(').length - 1;
  const saveAt = sliceSrc.indexOf('function saveToday()');
  const firstPutAt = sliceSrc.indexOf('profPut(');
  check('T4 every write in Edit today lives inside saveToday (the at-once writes are retired): 3 route writes, all after saveToday\u2019s head',
    puts === 3 && saveAt >= 0 && firstPutAt > saveAt, { puts, saveAt, firstPutAt });
  check('T5 the Clear act resets the draft and never writes (no route call in its handler)',
    sliceSrc.includes('clearedD = !!res.todayEdit;') && sliceSrc.includes('td = buildDraftFor(pickD, null);'));
}
check('T6 the standing words stand: the pick warning · the clear act · the teaching line · the editor warning',
  clientSrc.includes('Changing the pick clears today’s edits.')
  && clientSrc.includes('Clear today’s edits — follow the profile whole')
  && clientSrc.includes('Changes here stand for today only. To change every day, use Edit profiles.')
  && clientSrc.includes('data-p594warn="1">Changes here stand in every day that follows this profile.'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T7 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T8 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- vm world (harness-v594p2 pattern, carried) ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
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
  const w = makeWorld(johnStore(), '2026-11-21');
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('A1 no layer: Salesian weekday composition byte-identical to the pre-Part-2 ship, no mark',
    compOf(out) === ref && out.profile.key === 'salesian' && out.profile.resolvedBy === 'standing' && !out.profile.todayEdits,
    { got: compOf(out), mark: out.profile && out.profile.todayEdits });
}
{
  const w = makeWorld(johnStore(), '2026-11-22');
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A2 no layer: Sunday composition byte-identical, resolved day-default, no mark',
    compOf(out) === ref && out.profile.key === 'benedictine' && out.profile.resolvedBy === 'day-default' && !out.profile.todayEdits,
    { got: compOf(out) });
}

// ---------- L: the layer at the data level (carried) ----------
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
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-21', layer: null });
  const after = w.__payload('2026-11-21');
  check('L3 the clear (a null layer) deletes the entry and the day follows the profile whole',
    after.todayEdit === null, { te: after.todayEdit });
}
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const P = put(w);
  await P('/api/prayer/profiles/today-edit', { date: '2026-11-22', layer: { baseProfileKey: 'benedictine', coreBlocks: ['Morning'] } });
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('L4 a layer on OTHER dates only leaves today byte-identical, no mark',
    compOf(out) === ref && !out.profile.todayEdits, { got: compOf(out) });
}

// ---------- R: real-DOM legs ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available (npm i --no-save jsdom)', false, e.message);
  console.log('harness-v600:', ok, 'ok /', bad, 'not ok');
  process.exit(1);
}
const HOOK = '\n;window.__opn = { openConfigureLadder593: openConfigureLadder593, openEditTodayScreen594: openEditTodayScreen594, openProfilesScreen: openProfilesScreen, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, profPlanRowHtml: profPlanRowHtml };';
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
async function routePut(w, path, body) {
  return w.__opn.opnLocalApi(path, { method: 'PUT', body: JSON.stringify(body) }, w.__opn.opnMode());
}
function freshDom() {
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  return makeDomWorld(store);
}
const barOf = (w) => w.document.querySelector('[data-p593bar]');
const saveBtnOf = (w) => w.document.querySelector('[data-p593save="profile"]');
const todayBtnOf = (w) => w.document.querySelector('[data-p600savetoday]');
const todayLineOf = (w) => (w.document.querySelector('[data-p600todayline]') || {}).textContent || '';
const divLineOf = (w) => (w.document.querySelector('[data-p594tdivline]') || {}).textContent || '';

// R1: Edit profiles — the bar stands frozen always.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openProfilesScreen(null, { ladder: true });
  const up = await until(() => !!w.document.querySelector('[data-p591block="Night"]'));
  const bar = barOf(w), saveBtn = saveBtnOf(w);
  check('R1 the profiles acts bar stands with a CLEAN draft: bar visible, Save greyed, the line painted',
    up && !!bar && bar.hidden === false && !!saveBtn && saveBtn.disabled === true
    && ((w.document.querySelector('[data-p593barline]') || {}).textContent || '') === 'No unsaved changes',
    { up, hidden: bar && bar.hidden, dis: saveBtn && saveBtn.disabled });
  const scroller = w.document.querySelector('.profplan590 .panelbody');
  if (scroller) scroller.scrollTop = 120;
  click(w, w.document.querySelector('[data-p591block="Night"]'));
  await until(() => saveBtnOf(w) && saveBtnOf(w).disabled === false, 4000);
  check('R2 the first edit: the bar never moved (still standing), Save stands live, and the scroller\u2019s offset is unmoved',
    barOf(w) && barOf(w).hidden === false && saveBtnOf(w).disabled === false
    && !!scroller && scroller.scrollTop === 120,
    { hidden: barOf(w) && barOf(w).hidden, dis: saveBtnOf(w) && saveBtnOf(w).disabled, st: scroller && scroller.scrollTop });
}

// R3-R5: Edit today — draft, save, pick+layer together.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  const up = await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
  check('R3 Edit today opens with the frozen Save today bar standing and inert on the standing state',
    up && !!todayBtnOf(w) && todayBtnOf(w).disabled === true
    && w.document.querySelector('.proftodayfrozen600').hidden === false,
    { up, dis: todayBtnOf(w) && todayBtnOf(w).disabled });
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  const midPayload = await profilesPayload(w);
  check('R4 a draft edit writes NOTHING: the payload still carries no layer, while the draft counts 1 place and the bar reads unsaved',
    midPayload.todayEdit === null && /in 1 place/.test(divLineOf(w)) && /unsaved changes/.test(todayLineOf(w)),
    { te: midPayload.todayEdit, div: divLineOf(w), line: todayLineOf(w) });
  click(w, todayBtnOf(w));
  const landed = await until(async () => {
    const r = await profilesPayload(w);
    return !!(r.todayEdit && JSON.stringify(r.todayEdit.coreBlocks) === JSON.stringify(['Morning', 'Midday', 'Evening']));
  }, 6000);
  check('R5 Save today lands the layer (Night off); the bar returns to inert on the new standing state',
    landed && todayBtnOf(w).disabled === true && !/unsaved changes/.test(todayLineOf(w)),
    { landed, line: todayLineOf(w) });
  // the pick change, drafted then saved with the layer
  const warnStood = !!w.document.querySelector('[data-p594tpickwarn]');
  click(w, w.document.querySelector('[data-p594tchip="benedictine"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  const preSave = await profilesPayload(w);
  check('R6 the pick tap drafts only: the warning stood before it, the standing pick and layer stand untouched in the payload',
    warnStood && preSave.effective.key === 'salesian' && !!preSave.todayEdit,
    { warnStood, eff: preSave.effective.key, te: !!preSave.todayEdit });
  click(w, todayBtnOf(w));
  const picked = await until(async () => {
    const r = await profilesPayload(w);
    return r.todayEdit === null && r.effective.key === 'benedictine' && r.effective.resolvedBy === 'pick';
  }, 6000);
  check('R7 Save today writes pick + clear together: today follows Benedictine by pick, the layer is gone',
    picked, {});
}

// R8: a profile-whole draft writes no layer; the Clear
// act drafts a saved layer's removal without writing.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  const backClean = await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === true, 4000);
  const p0 = await profilesPayload(w);
  check('R8 undoing the only draft edit returns the draft to the profile whole: Save today inert, nothing written',
    backClean && p0.todayEdit === null, { backClean });
  await routePut(w, '/api/prayer/profiles/today-edit', { date: TODAY, layer: { baseProfileKey: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening'] } });
  // reopen on the standing layer
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tclear]'), 5000);
  click(w, w.document.querySelector('[data-p594tclear]'));
  await until(() => /stands as/.test(divLineOf(w)), 4000);
  const pMid = await profilesPayload(w);
  check('R9 the Clear act resets the DRAFT only: the line reads the profile whole, the saved layer still stands in the payload, Save today stands live',
    pMid.todayEdit !== null && todayBtnOf(w).disabled === false && /stands as/.test(divLineOf(w)),
    { te: pMid.todayEdit, dis: todayBtnOf(w) && todayBtnOf(w).disabled, div: divLineOf(w) });
  click(w, todayBtnOf(w));
  const cleared = await until(async () => (await profilesPayload(w)).todayEdit === null, 6000);
  check('R10 saving the cleared draft deletes the saved layer — the day follows the profile whole', cleared, {});
}

// R11: the close prompt — Discard · Stay · Save today.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
  const before = JSON.stringify(await profilesPayload(w));
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  click(w, w.document.querySelector('[data-p594tclose]'));
  const prompted = await until(() => !!w.document.querySelector('[data-p600prompt="discard"]'), 4000);
  check('R11 closing with a differing draft fires the prompt (Save today · Discard · Stay)', prompted, {});
  click(w, w.document.querySelector('[data-p600prompt="discard"]'));
  const closed = await until(() => !w.document.querySelector('.proftoday594'), 4000);
  const after = JSON.stringify(await profilesPayload(w));
  check('R12 Discard closes and the standing state stands byte-identical', closed && after === before, { closed });
  // Stay keeps drafting; Save today on the prompt writes + closes
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tblock="Midday"]'));
  click(w, w.document.querySelector('[data-p594tblock="Midday"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  click(w, w.document.querySelector('[data-p594tclose]'));
  await until(() => !!w.document.querySelector('[data-p600prompt="stay"]'), 4000);
  click(w, w.document.querySelector('[data-p600prompt="stay"]'));
  await sleep(300);
  check('R13 Stay closes the prompt only: the screen stands and the draft still counts its place',
    !!w.document.querySelector('.proftoday594') && /in 1 place/.test(divLineOf(w)) && !w.document.querySelector('[data-p600prompt]'),
    { div: divLineOf(w) });
  click(w, w.document.querySelector('[data-p594tclose]'));
  await until(() => !!w.document.querySelector('[data-p600prompt="save"]'), 4000);
  click(w, w.document.querySelector('[data-p600prompt="save"]'));
  const savedClosed = await until(async () => {
    const r = await profilesPayload(w);
    return !w.document.querySelector('.proftoday594') && !!(r.todayEdit && r.todayEdit.coreBlocks.indexOf('Midday') < 0);
  }, 6000);
  check('R14 the prompt\u2019s Save today writes the draft and closes the screen', savedClosed, {});
}

// R15: the ladder head reads the STANDING layer only.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  click(w, w.document.querySelector('[data-p594tclose]'));
  await until(() => !!w.document.querySelector('[data-p600prompt="discard"]'), 4000);
  click(w, w.document.querySelector('[data-p600prompt="discard"]'));
  await until(() => !w.document.querySelector('.proftoday594'), 4000);
  w.__opn.openConfigureLadder593();
  const head = w.document.querySelector('[data-p594ladderhead]');
  const noMark = await until(() => head && /Today follows/.test(head.textContent) && !/own edits/.test(head.textContent), 5000);
  check('R15 a discarded draft never marks the day: the ladder head states the standing pick with no edits mark',
    noMark, { head: head && head.textContent });
}

// R16: both-paths equivalence — a draft-save lands
// exactly the layer the at-once route write lands.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
  click(w, w.document.querySelector('[data-p594tblock="Night"]'));
  click(w, w.document.querySelector('[data-p594tblock="Midday"]'));
  await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
  click(w, todayBtnOf(w));
  let draftLayer = null;
  await until(async () => { const r = await profilesPayload(w); draftLayer = r.todayEdit; return !!draftLayer; }, 6000);
  // the at-once equivalent of the same two toggles
  // (Night + Midday off the Salesian core), written
  // directly through the standing route:
  const vmw2 = makeWorld(johnStore(), TODAY);
  const P2 = put(vmw2);
  await P2('/api/prayer/profiles/today-edit', { date: TODAY, layer: { baseProfileKey: 'salesian', coreBlocks: ['Morning', 'Evening'] } });
  const atOnce = vmw2.__payload(TODAY).todayEdit;
  check('R16 both paths land the same layer: the draft-save\u2019s layer deep-equals the at-once write\u2019s layer',
    !!draftLayer && JSON.stringify(draftLayer) === JSON.stringify(atOnce),
    { draft: draftLayer, atOnce });
}

// R17-R18: the locked-vault world — gate → unlock →
// draft → save lands (Part 1's lesson, on the draft).
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
  check('R17 a real vault envelope is created over John\u2019s document through the client\u2019s own pin-set path', made);
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
  check('R18 locked vault: Edit today stands the unlock gate, not the editor',
    gateStood && !w.document.querySelector('[data-p594tblock]'), { gate: gateStood });
  let landed = false, draftClean = false;
  if (gateStood && await unlockViaPad(w, '3141')) {
    const up = await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
    if (up) {
      click(w, w.document.querySelector('[data-p594tblock="Night"]'));
      await until(() => todayBtnOf(w) && todayBtnOf(w).disabled === false, 4000);
      draftClean = (await profilesPayload(w)).todayEdit === null;
      click(w, todayBtnOf(w));
      landed = await until(async () => {
        const r = await profilesPayload(w);
        return !!(r.todayEdit && Array.isArray(r.todayEdit.coreBlocks) && r.todayEdit.coreBlocks.indexOf('Night') < 0);
      }, 6000);
    }
  }
  check('R19 after the pad unlock, a draft edit writes nothing and Save today lands the layer (the field path, in the locked world)',
    draftClean && landed, { draftClean, landed });
}

console.log('harness-v600:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
