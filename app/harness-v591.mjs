// harness-v591.mjs — v591 Profiles: intuitiveness, second pass
// Legs (Plan §2.7, as corrected by John's final model,
// 2026-11-21 13:53 CT, and the 13:56/13:59 additions):
//  S  statics: blocks-first screen (head line, chips row,
//     real switches, contents open with the standing line);
//     the pop-up acts (Apply · Save Profile · Save New ·
//     Reset to Default, with their one-line explanations);
//     one configure row (the card carries NO configure
//     acts); NO "Current" as a configuration state on the
//     surface; steppers + Remove on contents rows; the
//     course badge label seat; server parity (reset route,
//     designed fixtures, the rule leg retired, the fold's
//     contents-prayer surfacing); SW pin unmoved pre-Ship;
//     migration 0044 still newest (the seed is code-level);
//     the rendered client parses whole.
//  A  EQUIVALENCE — with the seeded map and unedited
//     profiles, a Salesian weekday and a Sunday compose
//     byte-identical block lists + per-block track
//     identity to the v590-shipped composition; Sunday
//     now resolves through the seeded map (day-default).
//  M  migration seeding — dayRule=true + empty map seeds
//     Sunday → benedictine and retires the rule;
//     dayRule=false seeds nothing; a standing Sunday
//     entry is never overwritten.
//  P  the save model — Save Profile writes back into a
//     NAMED WAY (its stored record changes, no copy
//     mints); the day follows the edited way with no
//     other act; Save New mints under the given name and
//     the opened profile stands byte-identical; Reset
//     returns an edited way to the designed config; Reset
//     refuses a custom; the layers route writes a way
//     directly (the v590 guard is retired).
//  D  the day map — an overwritten Sunday stands; a day
//     follows its mapped profile after an in-place edit
//     + Save Profile, with no other act.
//  C  contents — the Add act (a prayer added stands in
//     the built day through the additions path); reorder
//     (the new order persists and the built day's
//     additions stand in that order); remove (the seat
//     retires when its selector leaves the list; the
//     remaining list stands exactly); remove the last
//     item (an explicit EMPTY contents stands — not
//     null — and the block's seat/additions stand empty);
//     a removed item returns through Add.
//  B  the course badge — the core fold's pointer on the
//     v589 production fixture stands at Day 322, label
//     included (the contents row's badge source).
// Fixtures from production only (Improvement D): John's
// import file (its profiles section) and the v589
// production podcast fixture.
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

// ---------- S statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('S1 blocks-first screen: head line + chips row + real switches + contents standing line',
  clientSrc.includes('Today follows ') && clientSrc.includes('profchips591') && clientSrc.includes('data-p591chip')
  && clientSrc.includes('switch591') && clientSrc.includes('data-p591block')
  && clientSrc.includes('Set by you — this block stands as listed') && clientSrc.includes('As the day brings it'));
check('S2 the pop-up acts stand with their explanations (Apply · Save Profile · Save New · Reset)',
  clientSrc.includes('data-p591papply') && clientSrc.includes('Save Profile') && clientSrc.includes('Save New')
  && clientSrc.includes('Reset to Default') && clientSrc.includes('It does not change the profile.')
  && clientSrc.includes('Save Profile writes these toggles into '));
const cardStart = clientSrc.indexOf('function profileCardHtml(day) {');
const cardEnd = clientSrc.indexOf('function openRenameCopySheet590', cardStart);
const cardSrc = clientSrc.slice(cardStart, cardEnd);
check('S3 one configure row: the profile card carries NO configure acts',
  !cardSrc.includes('data-profchange') && !cardSrc.includes('data-profcustomize')
  && !cardSrc.includes('data-proflayer') && !cardSrc.includes('data-podpick') && !cardSrc.includes('data-profexpand')
  && clientSrc.includes('data-profconfigure="1"'));
const surfStart = clientSrc.indexOf('/* ---------------- v515: Prayer Profiles');
const surfEnd = clientSrc.indexOf('function openProfileSheet()', surfStart);
const surfSrc = clientSrc.slice(surfStart, surfEnd);
check('S4 no "Current" as a configuration state anywhere on the profiles surface',
  surfStart > 0 && !surfSrc.includes('Current'), surfSrc.includes('Current') ? 'found' : '');
check('S5 contents rows carry steppers + a Remove act; blocks carry steppers; the Add act stands',
  clientSrc.includes('data-p591cup') && clientSrc.includes('data-p591cdown') && clientSrc.includes('data-p591cremove')
  && clientSrc.includes('data-p591up') && clientSrc.includes('data-p591down') && clientSrc.includes('data-p591add'));
check('S6 course rows carry the course name + Next standing (the label cache the universe reads)',
  clientSrc.includes('profCourseLabels591') && clientSrc.includes("' · Next: ' + s.currentLabel"));
check('S7 server parity: reset route + designed fixtures + rule leg retired + contents-prayer fold',
  indexSrc.includes('DESIGNED_PROFILES_591') && indexSrc.includes('seg[3] === "reset"')
  && indexSrc.includes('contentsPrayers') && !indexSrc.includes('"rule"')
  && !indexSrc.includes('store.dayRule && (dayKind'));
check('S11 the pop-up paints into its mounted inner container (the drawer chrome survives repaints)',
  clientSrc.includes("pop.querySelector('.profpopbody')") && clientSrc.includes('popBody.innerHTML = inner')
  && !clientSrc.includes('pop.innerHTML = inner'));
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S8 no new migration (the Sunday seed is code-level); 0044 still newest', migList[migList.length - 1].startsWith('0044'), migList[migList.length - 1]);
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('S9 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S10 served client (rendered APP_JS) parses whole', parses, perr);
}
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}

const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import.json', 'utf8'));
const FX = JSON.parse(readFileSync(APP + 'tests/fixtures-v589/production-podcast-fixture.json', 'utf8'));
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
  check('A1 Salesian weekday: byte-identical composition to the v590 ship',
    compOf(out) === ref && out.profile.key === 'salesian' && out.profile.resolvedBy === 'standing', { got: compOf(out), by: out.profile && out.profile.resolvedBy });
}
{
  const w = makeWorld(johnStore(), '2026-11-22'); // a Sunday
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A2 Sunday under the seeded map: byte-identical composition, resolved day-default (the rule retired)',
    compOf(out) === ref && out.profile.key === 'benedictine' && out.profile.resolvedBy === 'day-default', { got: compOf(out), by: out.profile && out.profile.resolvedBy });
}

// ---------- M: migration seeding ----------
{
  const store = johnStore();
  const w = makeWorld(store, '2026-11-21');
  w.__payload('2026-11-21');
  const stored = JSON.parse(store[DATA_KEY]);
  check('M1 dayRule=true + empty map: Sunday seeds to benedictine, the rule retires, mig591 marks',
    stored.sections.profiles.dayDefaults.sun === 'benedictine' && stored.sections.profiles.dayRule === false
    && stored.sections.profiles.mig591 === true, stored.sections.profiles.dayDefaults);
}
{
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.dayRule = false;
  const store = {};
  store[DATA_KEY] = JSON.stringify(doc);
  const w = makeWorld(store, '2026-11-21');
  w.__payload('2026-11-21');
  const stored = JSON.parse(store[DATA_KEY]);
  check('M2 dayRule=false seeds nothing', !stored.sections.profiles.dayDefaults.sun, stored.sections.profiles.dayDefaults);
}
{
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.dayDefaults = { sun: 'little-way' };
  const store = {};
  store[DATA_KEY] = JSON.stringify(doc);
  const w = makeWorld(store, '2026-11-21');
  w.__payload('2026-11-21');
  const stored = JSON.parse(store[DATA_KEY]);
  check('M3 a standing Sunday entry is never overwritten by the seed',
    stored.sections.profiles.dayDefaults.sun === 'little-way', stored.sections.profiles.dayDefaults);
}

// ---------- P: the save model ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  const before = w.__payload('2026-11-21');
  const sal = before.profiles.filter((p) => p.key === 'salesian')[0];
  const saved = await put('/api/prayer/profiles/save', { key: 'salesian', name: sal.name, honorLine: sal.honorLine, coreBlocks: ['Morning', 'Night'], layers: sal.layers });
  const salAfter = saved.profiles.filter((p) => p.key === 'salesian')[0];
  check('P1 Save Profile writes back into a NAMED WAY (record changes, no copy mints)',
    saved.profiles.length === 3 && JSON.stringify(salAfter.coreBlocks) === JSON.stringify(['Morning', 'Night']), salAfter.coreBlocks);
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x']))));
  check('P2 the day follows the edited way with no other act (Saturday composes Morning · Night · Novenas · Podcasts)',
    compOf(out) === ['Morning', 'Night', 'Novenas', 'Podcasts'].map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; '), compOf(out));
  const salJson = JSON.stringify(salAfter);
  const minted = await put('/api/prayer/profiles/save', { basedOn: 'salesian', name: 'Salesian — mine', honorLine: '', coreBlocks: ['Morning'], layers: sal.layers });
  check('P3 Save New mints under the given name; the opened profile stands byte-identical',
    minted.profiles.length === 4 && JSON.stringify(minted.profiles.filter((p) => p.key === 'salesian')[0]) === salJson,
    minted.profiles.map((p) => p.key));
  const reset = await put('/api/prayer/profiles/reset', { profileKey: 'salesian' });
  const salReset = reset.profiles.filter((p) => p.key === 'salesian')[0];
  check('P4 Reset returns the edited way to the DESIGNED config',
    JSON.stringify(salReset.coreBlocks) === JSON.stringify(['Morning', 'Midday', 'Evening', 'Night'])
    && salReset.layers.podcasts.on === true && salReset.layers.podcasts.series.length === 4
    && salReset.contents === undefined, salReset);
  let threw = null;
  const mine = reset.profiles.filter((p) => p.name === 'Salesian — mine')[0];
  try { await put('/api/prayer/profiles/reset', { profileKey: mine.key }); } catch (e) { threw = e; }
  check('P5 Reset refuses a custom (no designed default behind it)', !!threw, threw && threw.message);
  const lay = await put('/api/prayer/profiles/layers', { profileKey: 'benedictine', layers: { novenas: { on: false }, podcasts: { on: true, series: ['daily-readings'] } } });
  const ben = lay.profiles.filter((p) => p.key === 'benedictine')[0];
  check('P6 the layers route writes a way directly (the v590 guard retired)', ben.layers.novenas.on === false, ben.layers);
}

// ---------- D: the day map ----------
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
  // map Saturday to salesian, then edit salesian in place:
  await put('/api/prayer/profiles/state', { dayDefaults: { sat: 'salesian', sun: 'little-way' } });
  const sal = w.__payload('2026-11-21').profiles.filter((p) => p.key === 'salesian')[0];
  await put('/api/prayer/profiles/save', { key: 'salesian', name: sal.name, honorLine: sal.honorLine, coreBlocks: ['Morning'], layers: sal.layers });
  const sat = w.__payload('2026-11-21');
  check('D3 a day follows its mapped profile after an in-place edit + Save Profile, no other act',
    sat.effective.key === 'salesian' && JSON.stringify(sat.effective.coreBlocks) === JSON.stringify(['Morning']), sat.effective);
}

// ---------- C: contents — Add · reorder · remove ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  const sal = w.__payload('2026-11-21').profiles.filter((p) => p.key === 'salesian')[0];
  const layers = sal.layers;
  const mk = (name, contents) => put('/api/prayer/profiles/save', { basedOn: 'salesian', name, honorLine: '', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers, contents });
  const addsOf = (day, block) => (day.additions || []).filter((a) => a.block === block).map((a) => a.slug);
  // Add: a prayer standing in contents surfaces in the built day
  const c1 = await mk('With Angelus', { Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'prayer', key: 'angelus' }] });
  const mine1 = c1.profiles.filter((p) => p.name === 'With Angelus')[0];
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: mine1.key });
  const day1 = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', []))));
  check('C1 Add: a prayer added to a block stands in the built day (additions path)',
    JSON.stringify(addsOf(day1, 'Morning')) === JSON.stringify(['angelus']), day1.additions);
  // Reorder: two prayers, then the reverse order
  const c2 = await mk('Two prayers', { Morning: [{ kind: 'prayer', key: 'angelus' }, { kind: 'prayer', key: 'the-magnificat' }] });
  const mine2 = c2.profiles.filter((p) => p.name === 'Two prayers')[0];
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: mine2.key });
  const day2 = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', []))));
  check('C2a contents order stands in the built day (angelus, then the-magnificat)',
    JSON.stringify(addsOf(day2, 'Morning')) === JSON.stringify(['angelus', 'the-magnificat']), day2.additions);
  await put('/api/prayer/profiles/save', { key: mine2.key, name: 'Two prayers', honorLine: '', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers, contents: { Morning: [{ kind: 'prayer', key: 'the-magnificat' }, { kind: 'prayer', key: 'angelus' }] } });
  const day3 = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', []))));
  check('C2b a reorder persists in the contents and the built day stands in the new order',
    JSON.stringify(addsOf(day3, 'Morning')) === JSON.stringify(['the-magnificat', 'angelus']), day3.additions);
  // Remove: the seat selector leaves the list — the seat retires; the rest stands exactly
  const c3 = await mk('No seat', { Morning: [{ kind: 'source', key: 'morning-prayer' }] });
  const mine3 = c3.profiles.filter((p) => p.name === 'No seat')[0];
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: mine3.key });
  const daySeat = publicDay('2026-11-21', []);
  daySeat.readingsSeat = { seqKey: 'dr-1', title: 'Daily Reading' };
  const day4 = w.__scrub(JSON.parse(JSON.stringify(daySeat)));
  check('C3 Remove: with the seat selector removed, the seat retires and the contents stand exactly as listed',
    day4.readingsSeat === null && JSON.stringify(day4.profile.contents) === JSON.stringify({ Morning: [{ kind: 'source', key: 'morning-prayer' }] }), day4.profile && day4.profile.contents);
  // Remove the last item: an explicit EMPTY contents stands
  const c4 = await mk('Emptied', { Morning: [] });
  const mine4 = c4.profiles.filter((p) => p.name === 'Emptied')[0];
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: mine4.key });
  const eff4 = w.__payload('2026-11-21').effective;
  const daySeat2 = publicDay('2026-11-21', []);
  daySeat2.readingsSeat = { seqKey: 'dr-1', title: 'Daily Reading' };
  const day5 = w.__scrub(JSON.parse(JSON.stringify(daySeat2)));
  check('C4 removing the last item leaves an explicit EMPTY contents (not standing contents): seat off, no additions',
    Array.isArray(eff4.contents && eff4.contents.Morning) && eff4.contents.Morning.length === 0
    && day5.readingsSeat === null && addsOf(day5, 'Morning').length === 0, eff4.contents);
  // A removed item returns through Add
  await put('/api/prayer/profiles/save', { key: mine4.key, name: 'Emptied', honorLine: '', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers, contents: { Morning: [{ kind: 'prayer', key: 'angelus' }] } });
  const day6 = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', []))));
  check('C5 a removed item returns through Add (it stands in the built day again)',
    JSON.stringify(addsOf(day6, 'Morning')) === JSON.stringify(['angelus']), day6.additions);
}

// ---------- B: the course badge source ----------
{
  const w = makeWorld({}, '2026-11-21');
  const stripped = (entries) => entries.map((e) => { const c = { ...e }; delete c.listened; delete c.listenDate; delete c.listenedAt; delete c.positionS; return c; });
  const biblePayload = () => ({ ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true, entries: stripped(FX.bible.entries), currentKey: null, listenedCount: 0, total: FX.bible.entries.length, showImageUrl: null, showDesc: null });
  w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const rows = FX.bible.listens.map((r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source }));
  await w.__local('/api/player/podcasts/import-listens', { method: 'POST', body: JSON.stringify({ rows }) }, 'device');
  const idx = w.__fold({ ok: true, seriesList: [{ series: 'bible-in-a-year', title: 'Bible in a Year', kind: 'course' }] });
  const entry = idx.seriesList[0];
  check('B1 the course pointer stands at Day 322 on the production fixture (the badge reads "Next: Day 322")',
    entry.currentKey === 'biy:day-322' && entry.currentLabel === 'Day 322' && entry.listenedCount === 322, { cur: entry.currentKey, label: entry.currentLabel, c: entry.listenedCount });
}

console.log('harness-v591:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
