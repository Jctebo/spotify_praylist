// harness-v590.mjs — v590 Profiles: intuitive to see, plain to configure
// Legs (Plan §2.7, as amended):
//  S  statics: designed seed; the fold; the Profiles
//     screen + Configure plan first row; server parity
//     (per-day resolution, contents seat check, migration
//     0044); SW pin unmoved pre-Ship.
//  A  NO-OP EQUIVALENCE — a Salesian day and a Sunday
//     Benedictine day folded on-device with no contents
//     edits carry the server fold's composition exactly:
//     block list + per-block track identity byte-identical
//     to the reference composition, contents null.
//  B  the fold stands in the device shape — the public
//     payload's profile:null composes under the local
//     effective profile (the card's precondition).
//  C  contents — validation (layer kinds refused in core,
//     bad seat/course refused), the save route carries
//     contents, the fold carries them, a contents entry
//     gates the Morning seat in the fold.
//  D  copy mechanics — the layers route refuses a default
//     (rename_required) and changes nothing; a mint under
//     the default's own name is refused; a mint under a
//     given name lands and the default stands byte-
//     identical; copy-on-write routes through the rename
//     sheet (static seat).
//  E  migration — John's exact stored list (the import
//     file fixture) re-seats with ZERO copies minted;
//     a drifted default is preserved whole as
//     "<Name> — as found" before re-seating; customs
//     byte-identical; standingKey/picks/dayRule carried;
//     the version bumps once.
//  F  rename-required save — covered at the route in D;
//     here: a save-over of a default is refused whole.
//  G  per-day default resolution — a weekday's per-day
//     default beats the standing default AND the day
//     rule (Sunday); a per-date pick outranks it; an
//     absent map resolves exactly as today.
//  H  course selectors — on the v589 production fixture
//     (Bible in a Year whole, 372 entries, 322 listens):
//     the pointer the resolver reads stands at Day 322;
//     the finished course resolves null (empty slot); a
//     skip resolves to the first unlistened day episode.
// Fixtures from production only (Improvement D): John's
// import file (~/workspace/projects/ora-pro-nobis/
// john-personal-data-import.json — its profiles section)
// and the v589 production podcast fixture.
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
const seedLine = clientSrc.slice(clientSrc.indexOf('var OPN_SEED_PROFILES'), clientSrc.indexOf('var OPN_SEED_SOURCES'));
check('S1 the seed carries the DESIGNED configs (Salesian podcasts on, four series; Benedictine daily-readings)',
  seedLine.includes('"key": "salesian"') && seedLine.includes('"podcasts": {"on": true, "series": ["bible-in-a-year", "exorcist-files", "daily-gospel-exegesis", "daily-readings"]}')
  && seedLine.includes('"podcasts": {"on": true, "series": ["daily-readings"]}'));
check('S2 the on-device fold stands (opnFoldDay590, called from the day scrub)',
  clientSrc.includes('function opnFoldDay590(j)') && clientSrc.includes('return opnFoldDay590(j);'));
check('S3 Configure plan stands on the Praylist first row + the Profiles screen + the rename sheet stand',
  clientSrc.includes('data-profconfigure="1"') && clientSrc.includes('>Configure plan</button>')
  && clientSrc.includes('function openProfilesScreen(') && clientSrc.includes('function openRenameCopySheet590(')
  && clientSrc.includes('function resolveProfileCourses590(') && clientSrc.includes('function resolveReadingsSeat590('));
check('S4 the home paint emits the Configure plan row BEFORE the profile card',
  clientSrc.indexOf('profplanrow') > 0 && clientSrc.indexOf('profplanrow') < clientSrc.indexOf("profileCardHtml(day) + '<div id=\"favorites-folder-slot\""));
check('S5 server parity: per-day resolution + contents seat check + day_defaults store read',
  indexSrc.includes('resolvedBy: "pick" | "day-default" | "rule" | "standing"')
  && indexSrc.includes('morningContents.some((it) => it.kind === "seat"')
  && indexSrc.includes('SELECT day_defaults FROM prayer_profile_state')
  && indexSrc.includes('function validateProfileContents('));
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S6 migration 0044 stands (day_defaults), newest in the folder', migList[migList.length - 1].startsWith('0044'), migList[migList.length - 1]);
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('S7 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S8 served client (rendered APP_JS) parses whole', parses, perr);
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
  vm.runInContext("var OPN_DATA_KEY = 'opn-personal-data-v1';\nthis.todayChicago = function () { return '" + today + "'; };\n" + opnSlice + '\n' + seedSlice + '\n' + localSlice + '\n' + restoreSlice + '\n;this.__local = opnLocalApi; this.__scrub = opnScrubDayPayload; this.__payload = opnProfilesPayload; this.__core = opnPodCore; this.__fold = opnFoldPlaybackIntoPodcasts; this.__checkContents = opnCheckContents590; this.__restore = opnRestoreFromText;', world);
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

// ---------- A + B: equivalence + the fold stands ----------
{
  const w = makeWorld(johnStore(), '2026-11-21'); // a Saturday
  const day = publicDay('2026-11-21', ['x', 'y']);
  const out = w.__scrub(JSON.parse(JSON.stringify(day)));
  // The server fold's composition for the Salesian Way:
  // core in profile order, then Novenas, then Podcasts.
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('A1 Salesian day: the device fold composes exactly the server fold composition (blocks + track identity)',
    compOf(out) === ref, { got: compOf(out), ref });
  check('A2 no contents edits: the fold carries contents null (standing contents)',
    out.profile && out.profile.contents === null && out.profile.key === 'salesian' && out.profile.resolvedBy === 'standing', out.profile);
  check('B1 the fold stands in the device shape: profile:null composes under the local effective profile',
    !!out.profile && out.blocks.length === 6, out.profile && out.profile.key);
}
{
  const w = makeWorld(johnStore(), '2026-11-22'); // a Sunday
  const day = publicDay('2026-11-22', ['x']);
  const out = w.__scrub(JSON.parse(JSON.stringify(day)));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A3 Sunday Benedictine day (day rule): byte-identical composition, resolved by rule',
    compOf(out) === ref && out.profile.key === 'benedictine' && out.profile.resolvedBy === 'rule', { got: compOf(out), by: out.profile && out.profile.resolvedBy });
}

// ---------- E: migration on John's exact stored list ----------
{
  const store = johnStore();
  const before = JSON.stringify(JOHN.sections.profiles);
  const w = makeWorld(store, '2026-11-21');
  const payload = w.__payload('2026-11-21');
  const stored = JSON.parse(store[DATA_KEY]);
  check('E1 his stored list re-seats with ZERO copies minted (his Salesian equals the designed config)',
    stored.sections.profiles.list.length === 3 && stored.sections.profiles.list.every((p) => p.kind === 'default'), stored.sections.profiles.list.map((p) => p.key));
  check('E2 the migration bumps the version once and marks itself; standingKey/dayRule/picks carried',
    stored.sections.profiles.version === JOHN.sections.profiles.version + 1 && stored.sections.profiles.mig590 === true
    && stored.sections.profiles.standingKey === 'salesian' && stored.sections.profiles.dayRule === true, stored.sections.profiles.version);
  const w2 = makeWorld(store, '2026-11-21');
  w2.__payload('2026-11-21');
  const stored2 = JSON.parse(store[DATA_KEY]);
  check('E3 a second open does not migrate again (version stands)', stored2.sections.profiles.version === stored.sections.profiles.version, stored2.sections.profiles.version);
  check('E4 the payload names the designed Salesian (podcasts on, four series)', (() => {
    const sal = payload.profiles.filter((p) => p.key === 'salesian')[0];
    return sal.layers.podcasts.on === true && JSON.stringify(sal.layers.podcasts.series) === JSON.stringify(['bible-in-a-year', 'exorcist-files', 'daily-gospel-exegesis', 'daily-readings']);
  })());
}
{
  // A drifted default: the card-toggle leak's shape —
  // Salesian with Novenas flipped off (differs from BOTH
  // the old seed and the designed config).
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.list[1].layers.novenas.on = false;
  doc.sections.profiles.list.push({ key: 'mine', name: 'Mine', honorLine: '', kind: 'custom', coreBlocks: ['Morning'], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } });
  const customBefore = JSON.stringify(doc.sections.profiles.list[3]);
  const store = {};
  store[DATA_KEY] = JSON.stringify(doc);
  const w = makeWorld(store, '2026-11-21');
  w.__payload('2026-11-21');
  const stored = JSON.parse(store[DATA_KEY]);
  const found = stored.sections.profiles.list.filter((p) => p.name === 'The Salesian Way — as found')[0];
  const sal = stored.sections.profiles.list.filter((p) => p.key === 'salesian')[0];
  check('E5 a drifted default is preserved whole as "<Name> — as found" before re-seating',
    !!found && found.kind === 'custom' && found.layers.novenas.on === false && sal.layers.novenas.on === true, stored.sections.profiles.list.map((p) => p.name));
  check('E6 customs stand byte-identical through the migration',
    JSON.stringify(stored.sections.profiles.list.filter((p) => p.key === 'mine')[0]) === customBefore);
}

// ---------- C + D + F: contents, copy mechanics, rename ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  const layers = { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year'] } };
  let threw = null;
  try { await put('/api/prayer/profiles/layers', { profileKey: 'salesian', layers }); } catch (e) { threw = e; }
  check('D1 the layers route refuses a default (rename_required) — the leak is closed',
    !!threw && String(threw.message || '').includes('rename_required'), threw && threw.message);
  const after = w.__payload('2026-11-21');
  const sal = after.profiles.filter((p) => p.key === 'salesian')[0];
  check('D2 the refused write changed nothing (the default stands as designed)',
    sal.layers.podcasts.series.length === 4 && sal.layers.novenas.on === true);
  threw = null;
  try { await put('/api/prayer/profiles/save', { basedOn: 'salesian', name: 'The Salesian Way', honorLine: '', coreBlocks: ['Morning'], layers }); } catch (e) { threw = e; }
  check('F1 a mint under the source\'s own name is refused (rename required), nothing minted',
    !!threw && String(threw.message || '').includes('rename_required')
    && w.__payload('2026-11-21').profiles.length === 3, threw && threw.message);
  const salBefore = JSON.stringify(w.__payload('2026-11-21').profiles.filter((p) => p.key === 'salesian')[0]);
  const contents = { Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'course', key: 'bible-in-a-year' }, { kind: 'seat', key: 'daily-readings' }] };
  const saved = await put('/api/prayer/profiles/save', { basedOn: 'salesian', name: 'Salesian — mine', honorLine: '', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers, contents });
  const mine = saved.profiles.filter((p) => p.name === 'Salesian — mine')[0];
  check('D3 a mint under a given name lands as a custom, carrying its contents',
    !!mine && mine.kind === 'custom' && JSON.stringify(mine.contents) === JSON.stringify(contents), mine);
  check('D4 the default stands byte-identical after the mint',
    JSON.stringify(w.__payload('2026-11-21').profiles.filter((p) => p.key === 'salesian')[0]) === salBefore);
  threw = null;
  try { await put('/api/prayer/profiles/save', { key: 'salesian', name: 'X', honorLine: '', coreBlocks: ['Morning'], layers }); } catch (e) { threw = e; }
  check('F2 a save-over of a default is refused whole', !!threw && String(threw.message || '').includes('cannot be changed'), threw && threw.message);
  // contents validation
  let vErr = null;
  try { w.__checkContents({ Morning: [{ kind: 'novena', key: 'x' }] }, ['Morning']); } catch (e) { vErr = e; }
  check('C1 a layer kind in core contents is refused at validation', !!vErr, vErr && vErr.message);
  vErr = null;
  try { w.__checkContents({ Morning: [{ kind: 'course', key: 'not-a-course' }] }, ['Morning']); } catch (e) { vErr = e; }
  check('C2 a bad course key is refused at validation', !!vErr, vErr && vErr.message);
  vErr = null;
  try { w.__checkContents({ Morning: [{ kind: 'seat', key: 'not-the-seat' }] }, ['Morning']); } catch (e) { vErr = e; }
  check('C3 a bad seat key is refused at validation', !!vErr, vErr && vErr.message);
  // the fold carries contents + the seat gate
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: mine.key });
  const day = publicDay('2026-11-21', []);
  day.readingsSeat = { seqKey: 'dr-1', title: 'Daily Reading' };
  const folded = w.__scrub(JSON.parse(JSON.stringify(day)));
  check('C4 the fold carries the picked profile\'s contents', !!folded.profile && folded.profile.key === mine.key
    && JSON.stringify(folded.profile.contents) === JSON.stringify(contents), folded.profile && folded.profile.key);
  const day2 = publicDay('2026-11-21', []);
  day2.readingsSeat = { seqKey: 'dr-1', title: 'Daily Reading' };
  await put('/api/prayer/profiles/save', { basedOn: 'salesian', name: 'No seat copy', honorLine: '', coreBlocks: ['Morning'], layers, contents: { Morning: [{ kind: 'source', key: 'morning-prayer' }] } });
  const noSeat = w.__payload('2026-11-21').profiles.filter((p) => p.name === 'No seat copy')[0];
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-21', profileKey: noSeat.key });
  const folded2 = w.__scrub(JSON.parse(JSON.stringify(day2)));
  check('C5 a Morning contents entry without the seat selector retires the standing seat in the fold',
    folded2.readingsSeat === null, folded2.readingsSeat);
}

// ---------- G: per-day default resolution ----------
{
  const store = johnStore();
  const w = makeWorld(store, '2026-11-21'); // Saturday
  const put = (path, body) => w.__local(path, { method: 'PUT', body: JSON.stringify(body) }, 'device');
  await put('/api/prayer/profiles/state', { dayDefaults: { sat: 'little-way', sun: 'little-way' } });
  const sat = w.__payload('2026-11-21');
  check('G1 a per-day default beats the standing default (Saturday → The Little Way)',
    sat.effective.key === 'little-way' && sat.effective.resolvedBy === 'day-default', sat.effective);
  const sun = w.__payload('2026-11-22');
  check('G2 a per-day default beats the day rule (Sunday → The Little Way, not Benedictine)',
    sun.effective.key === 'little-way' && sun.effective.resolvedBy === 'day-default', sun.effective);
  await put('/api/prayer/profiles/day-pick', { date: '2026-11-22', profileKey: 'salesian' });
  const sunPick = w.__payload('2026-11-22');
  check('G3 a per-date pick outranks the per-day default', sunPick.effective.key === 'salesian' && sunPick.effective.resolvedBy === 'pick', sunPick.effective);
  const mon = w.__payload('2026-11-23');
  check('G4 a weekday absent from the map resolves exactly as today (standing default)',
    mon.effective.key === 'salesian' && mon.effective.resolvedBy === 'standing', mon.effective);
}

// ---------- H: course selectors on the production fixture ----------
{
  const w = makeWorld({}, '2026-11-21');
  const stripped = (entries) => entries.map((e) => { const c = { ...e }; delete c.listened; delete c.listenDate; delete c.listenedAt; delete c.positionS; return c; });
  const biblePayload = () => ({ ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true, entries: stripped(FX.bible.entries), currentKey: null, listenedCount: 0, total: FX.bible.entries.length, showImageUrl: null, showDesc: null });
  w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const rows = FX.bible.listens.map((r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source }));
  await w.__local('/api/player/podcasts/import-listens', { method: 'POST', body: JSON.stringify({ rows }) }, 'device');
  const out = w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  check('H1 the course pointer stands at Day 322 on the production fixture (322 listens)',
    out.currentKey === 'biy:day-322' && out.listenedCount === 322, { cur: out.currentKey, c: out.listenedCount });
  // finished course: mark the rest
  const rest = out.entries.filter((e) => !e.listened).map((e) => e.key);
  for (const k of rest) await w.__local('/api/player/podcasts/mark', { method: 'POST', body: JSON.stringify({ series: 'bible-in-a-year', seqKey: k, source: 'manual' }) }, 'device');
  const done = w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  check('H2 a finished course resolves null — the selector\'s slot stands empty',
    done.currentKey === null || done.currentKey === undefined, done.currentKey);
}
{
  const w = makeWorld({}, '2026-11-21');
  const entries = [1, 2, 3, 4, 5].map((d) => ({ key: 'biy:day-' + d, kind: 'day', day: d, label: 'Day ' + d, title: 'T' + d, url: 'https://x/' + d + '.mp3', durationS: 100 }));
  const payload = { ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true, entries: JSON.parse(JSON.stringify(entries)), currentKey: null, listenedCount: 0, total: 5 };
  w.__fold(JSON.parse(JSON.stringify(payload)));
  // listened: days 1, 2, 4 — day 3 skipped
  for (const k of ['biy:day-1', 'biy:day-2', 'biy:day-4']) {
    await w.__local('/api/player/podcasts/mark', { method: 'POST', body: JSON.stringify({ series: 'bible-in-a-year', seqKey: k, source: 'manual' }) }, 'device');
  }
  const out = w.__fold(JSON.parse(JSON.stringify(payload)));
  check('H3 a skip resolves to the first unlistened day episode (Day 3, no jumping past)',
    out.currentKey === 'biy:day-3', out.currentKey);
}

// ---------- R: the restore path runs the migration too ----------
{
  const store = {};
  const w = makeWorld(store, '2026-11-21');
  const counts = await w.__restore(JSON.stringify(JOHN));
  const stored = JSON.parse(store[DATA_KEY]);
  check('R1 restoring John\'s file lands his profiles and the restored doc stands migrated (pristine, no copies)',
    counts.profiles === 3 && stored.sections.profiles.mig590 === true && stored.sections.profiles.list.length === 3, counts);
}

console.log('harness-v590:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
