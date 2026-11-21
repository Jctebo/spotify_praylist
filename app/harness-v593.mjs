// harness-v593.mjs — v593 Configure without pop-ups
// (the ladder · chips switch in place · the dirty-only
// acts bar · jump-chips with scrollspy · the Day mapping
// screen). Built on the PICKS AS PICKED (approval record
// 40, package 84): Q1=B prompt on switch · Q2=A today
// changes too · Q3=C bar only when dirty · Q4=A jump
// strip · Q5=A the ladder · Q6=A land at the top · Q7=B.
//  T  statics on the client/ui sources: the ladder's two
//     doors · one configure act · the chip switch
//     (day-pick of the saved shape) · the prompt's three
//     acts · the hidden-until-dirty bar + Save New's
//     clean home · the jump strip + scrollspy + hairline
//     · the Day mapping screen · NO pop-up code path in
//     the profile flow · the anchored repaint · the
//     frozen zone's seat above the scroller · no new
//     migration · SW pin unmoved pre-Ship · the rendered
//     client parses whole.
//  A  EQUIVALENCE — with the seeded map and unedited
//     profiles, a Salesian weekday and a Sunday compose
//     byte-identical to the v592 ship.
//  D  the day map still resolves (an overwritten Sunday).
//  F  the data layer under the picks: a day-pick stands
//     the tapped profile for today (Q2=A's instrument);
//     a mapping assignment writes at once and the day
//     follows it (the Day mapping screen's write).
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
const edStart = clientSrc.indexOf('function openConfigureLadder593');
const edEnd = clientSrc.indexOf('function openProfileSheet()', edStart);
const edSrc = clientSrc.slice(edStart, edEnd);

check('T1 the ladder paints exactly two doors and each opens its own screen; the ladder close stands',
  clientSrc.includes('function openConfigureLadder593()')
  && (edSrc.match(/card bookrow" data-p593door=/g) || []).length === 2
  && edSrc.includes('data-p593door="edit"') && edSrc.includes('data-p593door="map"')
  && edSrc.includes('openProfilesScreen(null, { ladder: true })')
  && edSrc.includes('openDayMappingScreen593(true)')
  && edSrc.includes('data-p593ladderclose'));
check('T2 one configure act: exactly one painted data-profconfigure; the card carries none; Configure doors open the ladder',
  (clientSrc.match(/data-profconfigure="1"/g) || []).length === 1
  && (() => { const a = clientSrc.indexOf('function profileCardHtml(day) {'); const b = clientSrc.indexOf('function openRenameCopySheet590', a); const card = clientSrc.slice(a, b); return !card.includes('data-profchange') && !card.includes('data-profcustomize') && !card.includes('data-profconfigure'); })()
  && clientSrc.includes("profBtn590.addEventListener('click', function () { openConfigureLadder593(); });")
  && (clientSrc.match(/openConfigureLadder593\(\); \}\);/g) || []).length >= 3);
check('T3 the chip switch (Q2=A): a clean chip tap day-picks the tapped profile (its saved shape) and lands at the top (Q6=A)',
  edSrc.includes('function chipTap(key)')
  && edSrc.includes('function doSwitch(key)')
  && edSrc.includes("profPut('/api/prayer/profiles/day-pick', { date: todayChicago(), profileKey: key })")
  && edSrc.includes('if (scroller) scroller.scrollTop = 0;')
  && edSrc.includes('profileRebuild();'));
check('T4 the switch prompt (Q1=B): a dirty chip tap prompts first — Save writes then switches · Discard drops then switches · Stay does not switch',
  edSrc.includes('if (draftDirty(ed)) { openSwitchPrompt(key); return; }')
  && edSrc.includes('data-p593prompt="save"') && edSrc.includes('data-p593prompt="discard"') && edSrc.includes('data-p593prompt="stay"')
  && edSrc.includes("if (act === 'save') saveProfileDraft(function () { doSwitch(targetKey); });")
  && edSrc.includes("else if (act === 'discard') { ed = null; doSwitch(targetKey); }"));
check('T5 the acts bar (Q3=C): hidden while clean, stands while dirty, carries Save · Save New + the status line naming the profile; Save New also stands in the This profile zone',
  edSrc.includes('data-p593bar="1" hidden')
  && edSrc.includes('barEl.hidden = !dirty;')
  && edSrc.includes("ed.name + ' · unsaved changes'")
  && edSrc.includes('data-p593save="profile"') && edSrc.includes('data-p593save="new"')
  && edSrc.includes('data-p593savenew="1"')
  && edSrc.indexOf('profzone593') > edSrc.indexOf('function paint()'));
check('T6 tracking (Q4=A): the frozen jump strip names all eight blocks; jump + scrollspy + the progress hairline stand',
  edSrc.includes("HOURS.concat(['Novenas', 'Podcasts'])")
  && edSrc.includes('data-p593jumpbtn')
  && edSrc.includes('function jumpTo(name)')
  && edSrc.includes('function spyUpdate()')
  && edSrc.includes("scroller.addEventListener('scroll'")
  && edSrc.includes('data-p593hair="1"')
  && uiSrc.includes('.profjump593') && uiSrc.includes('.profjumbtn593.on'));
check('T7 the Day mapping screen: week rows incl. Every day; the assignment view writes at once; the two standing lines stand',
  edSrc.includes('function openDayMappingScreen593(fromLadder)')
  && edSrc.includes('data-p593mapday="standing"') && edSrc.includes('data-p593mapday')
  && edSrc.includes('data-p593stand="1"') && edSrc.includes("'Stand for ' + esc(label)")
  && edSrc.includes('Standing a profile for a day takes effect at once.')
  && edSrc.includes('To change what a profile contains, use Configure plan.')
  && edSrc.includes("profPut('/api/prayer/profiles/state', { dayDefaults: nd })"));
check('T8 NO pop-up code path remains in the profile flow (the pop-up + the mapping pop-up + the head button are retired whole)',
  !clientSrc.includes('function openPop') && !clientSrc.includes('openMapPop')
  && !clientSrc.includes('profpop591') && !clientSrc.includes('profmap592')
  && !clientSrc.includes('data-p592daymap') && !clientSrc.includes('data-p591pchip')
  && !clientSrc.includes('data-p591chip'));
check('T9 the anchored repaint: block paints carry anchors; wireBlocks hands the tapped button to the repaint; the repaint restores scroll by the anchor delta',
  edSrc.includes('data-p593anchor="') && edSrc.includes('data-p593anchor="Novenas"') && edSrc.includes('data-p593anchor="Podcasts"')
  && edSrc.includes('function anchoredRepaint(btn)')
  && edSrc.includes('scroller.scrollTop += nel.getBoundingClientRect().top - top;')
  && (edSrc.match(/repaint\(btn\);/g) || []).length >= 7);
check('T10 the frozen zone seats above the scroller (flex sibling), so the bar appearing cannot move the content offset',
  edSrc.includes('innerEl.insertBefore(frozen, scroller)')
  && edSrc.includes("sheet.querySelector('.panelbody')")
  && uiSrc.includes('.proffrozen593 { flex:none;'));
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('T11 no new migration; 0044 still newest', migList[migList.length - 1].startsWith('0044'), migList[migList.length - 1]);
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T12 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T13 served client (rendered APP_JS) parses whole', parses, perr);
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
  check('A1 Salesian weekday: byte-identical composition to the v592 ship',
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

// ---------- F: the data layer under the picks ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: 'little-way' });
  const today = w.__payload('2026-11-21');
  check('F1 a day-pick stands the tapped profile for today (Q2=A instrument), resolved as a pick',
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
  check('F3 a mapping assignment writes at once and the day follows it (the Day mapping screen write)',
    tue.effective.key === 'benedictine' && tue.effective.resolvedBy === 'day-default', tue.effective);
}

console.log('harness-v593:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
