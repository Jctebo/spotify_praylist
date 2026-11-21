// harness-v592.mjs — v592 Configure screen polish
// (compact · full-screen · day mapping pop-up · one
// configure row). Presentation only: the v591 model stands
// underneath, so the functional legs are the day-map
// resolution and the EQUIVALENCE gate against the
// v591-shipped composition.
//  T  statics: the compact dress (scoped tightened values
//     in ui.ts) · the full-screen root class + rule · the
//     Day mapping button in the screen's head (after the
//     head line, before the chips) · the mapping paints as
//     a pop-up (openMapPop, the stable-body discipline) with
//     NO standing mapping section left on the screen · the
//     Praylist carries exactly ONE painted configure act
//     and the profile card carries none · SW pin unmoved
//     pre-Ship · no new migration · the rendered client
//     parses whole.
//  A  EQUIVALENCE — with the seeded map and unedited
//     profiles, a Salesian weekday and a Sunday compose
//     byte-identical block lists + per-block track
//     identity to the v591-shipped composition.
//  D  the day map still resolves — an overwritten Sunday
//     stands and composes its profile.
// Fixtures from production only (Improvement D): John's
// import file (its profiles section).
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 compact dress: the scoped tightened values stand in ui.ts',
  uiSrc.includes('.profplan590 .bookrow, .profpop591 .bookrow, .profmap592 .bookrow { padding:8px 10px; margin:0 0 6px; }')
  && uiSrc.includes('.profplan590 .sub, .profpop591 .sub, .profmap592 .sub { margin:0 0 8px; }')
  && uiSrc.includes('.profplan590 .profchips591, .profpop591 .profchips591 { margin:0 0 8px; padding-bottom:2px; }')
  && uiSrc.includes('.profplan590 .chip591, .profpop591 .chip591 { padding:5px 11px; min-height:38px; }')
  && uiSrc.includes('.profplan590 .profcontents591, .profpop591 .profcontents591 { margin:0 0 6px 10px; }'));
check('T2 full screen: the screen root carries the full-screen class and the edge-to-edge rule stands',
  clientSrc.includes("sheet.className = 'sheet profplan590 profscreenfull592'")
  && uiSrc.includes('.sheet.profscreenfull592 .inner { width:100%; max-width:none; height:100dvh !important; max-height:100dvh !important; border-radius:0; }'));
const scrStart = clientSrc.indexOf('function openProfilesScreen');
const scrEnd = clientSrc.indexOf('function openProfileSheet()', scrStart);
const scrSrc = clientSrc.slice(scrStart, scrEnd);
check('T3 the Day mapping button stands in the head — after the head line, before the chips row',
  scrSrc.includes('data-p592daymap="1">Day mapping</button>')
  && scrSrc.indexOf('data-p591head') < scrSrc.indexOf('data-p592daymap')
  && scrSrc.indexOf('data-p592daymap') < scrSrc.indexOf("'<div class=\"profchips591\">'"));
check('T4 the mapping paints as a pop-up (stable body, rows open the profile pop-up) and NO standing section remains',
  scrSrc.includes('function openMapPop()') && scrSrc.includes('profmap592') && scrSrc.includes('profmapbody')
  && scrSrc.includes('data-p592mapday') && scrSrc.includes('mapBody.innerHTML = html')
  && !clientSrc.includes('data-p591day') && !scrSrc.includes('Day by day'));
check('T5 the Praylist carries exactly ONE painted configure act; the profile card carries none',
  (clientSrc.match(/data-profconfigure="1"/g) || []).length === 1
  && (() => { const a = clientSrc.indexOf('function profileCardHtml(day) {'); const b = clientSrc.indexOf('function openRenameCopySheet590', a); const card = clientSrc.slice(a, b); return !card.includes('data-profchange') && !card.includes('data-profcustomize') && !card.includes('data-profconfigure'); })());
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('T6 no new migration; 0044 still newest', migList[migList.length - 1].startsWith('0044'), migList[migList.length - 1]);
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
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}

const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import.json', 'utf8'));
const DATA_KEY = 'opn-personal-data-v1';

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
  vm.runInContext("var OPN_DATA_KEY = 'opn-personal-data-v1';\nthis.todayChicago = function () { return '" + today + "'; };\n" + opnSlice + '\n' + seedSlice + '\n' + localSlice + '\n' + restoreSlice + '\n;this.__local = opnLocalApi; this.__scrub = opnScrubDayPayload; this.__payload = opnProfilesPayload; this.__core = opnPodCore; this.__fold = opnFoldPlaybackIntoPodcasts;', world);
  vm.runInContext("this.window = { __OPN_SHAPE__: 'public' }; this.oraInShell = function () { return true; };", world);
  return world;
}
function johnStore() {
  const store = {};
  store[DATA_KEY] = JSON.stringify(JOHN);
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

// ---------- A: equivalence (the gate) ----------
{
  const w = makeWorld(johnStore(), '2026-11-21'); // a Saturday
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('A1 Salesian weekday: byte-identical composition to the v591 ship',
    compOf(out) === ref && out.profile.key === 'salesian' && out.profile.resolvedBy === 'standing', { got: compOf(out), by: out.profile && out.profile.resolvedBy });
}
{
  const w = makeWorld(johnStore(), '2026-11-22'); // a Sunday
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A2 Sunday under the seeded map: byte-identical composition, resolved day-default',
    compOf(out) === ref && out.profile.key === 'benedictine' && out.profile.resolvedBy === 'day-default', { got: compOf(out), by: out.profile && out.profile.resolvedBy });
}

// ---------- D: the day map still resolves ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  await put('/api/prayer/profiles/state', { dayDefaults: { sun: 'little-way' } });
  const sun = w.__payload('2026-11-22');
  check('D1 an overwritten Sunday stands (the seed is a default, not a rule)',
    sun.effective.key === 'little-way' && sun.effective.resolvedBy === 'day-default', sun.effective);
  const outSun = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  check('D2 the overwritten Sunday composes the Little Way (Morning · Night only)',
    compOf(outSun) === 'Morning|Morning-t0 ; Night|Night-t0', compOf(outSun));
}

console.log('harness-v592:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
