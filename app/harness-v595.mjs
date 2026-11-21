// harness-v595.mjs — v595 the Praylist profile card retires
// (John, Ora thread, 2026-11-21 15:39 CT, with his
// screenshot of the Praylist, the card scribbled out:
// "And please stop showing this row.") Presentation only:
// the card's paint + call + its dead card-era wiring are
// removed; the day's composition, the fold, profile state,
// and personal data stand untouched — equivalence is the
// gate.
//  T  statics: no card paint / call / card-era wiring /
//     paint flag stands in the client · exactly one
//     configure act on the Praylist · both ladder doors
//     (the Configure plan row · Settings) stand · no new
//     migration · SW pin unmoved pre-Ship · the rendered
//     client parses whole.
//  P  the RENDERED Praylist paint: paintListenHome run in
//     a vm world with a profile fold standing — the plan
//     row paints, the Favorites slot follows it, and NO
//     profile card paints (no profcard class, no fold
//     name, no honor line, no resolution line).
//  A  EQUIVALENCE — with the seeded map and unedited
//     profiles, a Salesian weekday and a Sunday compose
//     byte-identical to the v593 ship.
//  D  the day map still resolves (an overwritten Sunday).
//  F  the data layer stands: a day-pick stands a profile
//     for today; a mapping assignment writes at once.
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

check('T1 the card is gone whole: no profileCardHtml paint, no profcard class, no paint flag, no card-era wiring, no resolution lines',
  !clientSrc.includes('function profileCardHtml')
  && !clientSrc.includes('card profcard')
  && !clientSrc.includes('profCardOpen')
  && !clientSrc.includes("querySelectorAll('[data-profchange]')")
  && !clientSrc.includes("querySelectorAll('[data-profexpand]')")
  && !clientSrc.includes("querySelectorAll('[data-profcustomize]')")
  && !clientSrc.includes('Your every-day profile')
  && !clientSrc.includes('Your pick for today')
  && !clientSrc.includes('From the day mapping'));
check('T2 one configure act: exactly one painted data-profconfigure on the Praylist; the Configure plan row stands in paintListenHome',
  (clientSrc.match(/data-profconfigure="1"/g) || []).length === 1
  && clientSrc.includes('card profplanrow')
  && clientSrc.includes('Prayer plan'));
check('T3 both ladder doors stand: the Configure plan wiring + the Settings door both open the ladder; the ladder keeps its two doors',
  clientSrc.includes("view.querySelectorAll('[data-profconfigure]').forEach")
  && clientSrc.includes("profBtn590.addEventListener('click', function () { openConfigureLadder593(); });")
  && clientSrc.includes('function openConfigureLadder593()')
  && clientSrc.includes('data-p593door="edit"') && clientSrc.includes('data-p593door="map"'));
check('T4 the shared write helpers stand untouched (the ladder, mapping, and editor still write through them)',
  clientSrc.includes('function profPut(path, body)')
  && clientSrc.includes('function profileRebuild()'));
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('T5 no new migration; 0044 still newest', migList[migList.length - 1].startsWith('0044'), migList[migList.length - 1]);
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T6 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T7 served client (rendered APP_JS) parses whole', parses, perr);
}
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}

// ---------- P: the rendered Praylist paint ----------
{
  const world = { console, JSON, Object, Array, String, Number };
  vm.createContext(world);
  const paintSlice = slice('function paintListenHome(day)', 'function homeBodyHtml(day)');
  vm.runInContext(
    'this.view = { innerHTML: "" };\n'
    + 'this.paintPrayersBar = function () {};\n'
    + 'this.homeBodyHtml = function () { return "<div id=\\"blocks-marker\\"></div>"; };\n'
    + 'this.offlineLineHtml = function () { return ""; };\n'
    + 'this.paintFavoritesFolderRow = function () {};\n'
    + paintSlice + '\nthis.__paint = paintListenHome;', world);
  const day = { date: '2026-11-21', profile: { key: 'salesian', name: 'The Salesian Way', resolvedBy: 'standing', honorLine: "named in honor of the tradition, not the order's own routine" } };
  vm.runInContext('this.__paint(' + JSON.stringify(day) + ');', world);
  const html = world.view.innerHTML;
  check('P1 the Praylist paints the Prayer plan row with its one Configure plan act',
    html.includes('Prayer plan') && (html.match(/data-profconfigure="1"/g) || []).length === 1, html.slice(0, 200));
  check('P2 NO profile card paints under a standing fold: no profcard, no fold name, no honor line, no resolution line',
    !html.includes('profcard') && !html.includes('The Salesian Way')
    && !html.includes('named in honor') && !html.includes('every-day profile'), html.slice(0, 300));
  check('P3 the standing order: Prayer plan row → Favorites slot → the blocks',
    html.indexOf('profplanrow') >= 0
    && html.indexOf('profplanrow') < html.indexOf('favorites-folder-slot')
    && html.indexOf('favorites-folder-slot') < html.indexOf('blocks-marker'), html.slice(0, 300));
}

// ---------- the fold world (equivalence + data layer) ----------
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
  check('A1 Salesian weekday: byte-identical composition to the v593 ship',
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

// ---------- F: the data layer stands ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: 'little-way' });
  const today = w.__payload('2026-11-21');
  check('F1 a day-pick stands the tapped profile for today, resolved as a pick',
    today.effective.key === 'little-way' && today.effective.resolvedBy === 'pick', today.effective);
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x']))));
  check('F2 today then composes the tapped profile (Morning · Night only)',
    compOf(out) === 'Morning|Morning-t0 ; Night|Night-t0', compOf(out));
}
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  await put('/api/prayer/profiles/state', { dayDefaults: { tue: 'benedictine' } });
  const tue = w.__payload('2026-11-24'); // a Tuesday
  check('F3 a mapping assignment writes at once and the day follows it',
    tue.effective.key === 'benedictine' && tue.effective.resolvedBy === 'day-default', tue.effective);
}

console.log('harness-v595:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
