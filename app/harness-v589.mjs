// harness-v589.mjs — v589 Core podcast model + views
// Legs (Plan §2.6):
//  S  statics: the core store + projection + import seam
//     stand; the old fold's store walk is gone; index.ts
//     untouched vs main; migrations end at 0042; SW pin
//     unmoved pre-Ship.
//  C1 one core, every view: for one fixture series of EACH
//     kind (sequence Bible · RSS Exorcist · own AI Signal ·
//     novena), ingest + project — entries carry core state
//     and the count reads the same core as the rows.
//  C2 cross-view mark: a mark written through the local
//     route shows in the series projection, the index
//     projection, and a fresh reload's projection; unmark
//     clears all three.
//  C3 the migration fixture (v588): the 322 production
//     Bible rows import whole — count 322, current
//     biy:day-322, Days 1-321 + the bonus listened, Day 322
//     not; a planted orphan row is refused, counted, and
//     applied nowhere.
//  C4 legacy migration: a seeded legacy playback store
//     moves into the core; at ingest the orphan key drops
//     and is counted; the legacy store keeps dayPositions.
//  C5 no second fold: the painters' mark acts write the
//     core and take counts from the projection (static
//     seats), and a toggled count equals the core's count.
//  R  the restore bridge (fix-forward): a file carrying a
//     podcastListens section restores its rows into the
//     core through opnRestoreFromText — the shipped build
//     restored only the personal-data document and the
//     section landed nowhere; a file without the section
//     restores exactly as before.
// Fixtures: app/tests/fixtures-v589/production-podcast-
// fixture.json — drawn from production (Improvement D):
// the Bible snapshot's 372 entries whole, all 331 server
// listen rows, snapshot heads for Catechism/Exorcist, the
// own series' standing entries (read 2026-11-21).
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
check('S1 the core store stands in the layer', clientSrc.includes("var OPN_PODCAST_CORE_KEY = 'opn-podcast-core-v1'") && clientSrc.includes('function opnPodCore()') && clientSrc.includes('function opnPodProjectSeries(core, holder)'));
check('S1 the import seam stands', clientSrc.includes("'/api/player/podcasts/import-listens'") && clientSrc.includes('function opnPodCoreImportListens(rows)'));
check('S1 mark routes write the core', clientSrc.includes('opnPodCoreSetListen(body.series, body.seqKey') && clientSrc.includes('opnPodCoreSetPosition(body.series, body.seqKey'));
const foldAt = clientSrc.indexOf('function opnFoldPlaybackIntoPodcasts');
const foldText = clientSrc.slice(foldAt, clientSrc.indexOf('function api(path, opts)', foldAt));
check('S2 the fold is the core projection (no legacy store walk, no stripped-field gate)', foldText.includes('opnPodProjectSeries(core, j)') && foldText.includes('opnPodCoreCounts(core, s.series)') && !foldText.includes('opnPlayback()') && !foldText.includes("'listened' in o"));
check('S2 the fold gate is entry identity', foldText.includes("typeof o.key === 'string'") && foldText.includes("typeof o.streamUrl === 'string'"));
const diffNames = git(['diff', '--name-only', 'main', '--', 'app/worker/src', 'app/migrations']).trim().split('\n').filter(Boolean);
check('S3 diff confined to client.ts in src; index.ts untouched; migrations untouched', diffNames.every((f) => f === 'app/worker/src/client.ts'), diffNames);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S3 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('S3 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc) });
check('S5 painter mark acts write the core + take counts from the projection', (clientSrc.match(/opnPodCoreSetListen\(/g) || []).length >= 4 && clientSrc.includes('opnPodProjectSeries(opnPodCore(), res)') && clientSrc.includes('opnPodProjectSeries(opnPodCore(), state.podcasts)'));

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S6 served client (rendered APP_JS) parses whole', parses, perr);
}
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const FX = JSON.parse(readFileSync(APP + 'tests/fixtures-v589/production-podcast-fixture.json', 'utf8'));

function makeWorld(store) {
  const world = {
    console, URLSearchParams, Promise, Date, JSON, Object, Array, String, Number, Math, Set, Map, Error, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  vm.createContext(world);
  const opnSlice = slice('var OPN_PLAYBACK_KEY', '/* ---- local per-track intention draws');
  const seedSlice = slice('var OPN_SEED_PROFILES', 'function opnLocalApi');
  const localSlice = slice('function opnLocalApi', '/* Post-processing for content reads');
  const foldSlice = slice('function opnFoldPlaybackIntoPodcasts', 'function api(path, opts)');
  const restoreSlice = slice('function opnCountsOf', 'function opnHasSnapshot');
  vm.runInContext("this.todayChicago = function () { return '2026-11-21'; };\n" + opnSlice + '\n' + seedSlice + '\n' + localSlice + '\n' + foldSlice + '\n' + restoreSlice + '\n;this.__fold = opnFoldPlaybackIntoPodcasts; this.__local = opnLocalApi; this.__core = opnPodCore; this.__save = opnPlaybackSave; this.__coreSave = opnPodCoreSave; this.__restore = opnRestoreFromText;', world);
  return world;
}
const stripped = (entries) => entries.map((e) => { const c = { ...e }; delete c.listened; delete c.listenDate; delete c.listenedAt; delete c.positionS; return c; });
const biblePayload = () => ({ ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true, entries: stripped(FX.bible.entries), currentKey: null, listenedCount: 0, total: FX.bible.entries.length, showImageUrl: null, showDesc: null });
const bibleIndex = () => ({ ok: true, seriesList: [{ series: 'bible-in-a-year', title: 'Bible in a Year', available: true, listenedCount: 0, total: 372, currentKey: null, currentLabel: null, category: 'courses' }] });

// ---------- C3 + C1 (sequence): the migration fixture ----------
{
  const store = {};
  const w = makeWorld(store);
  // Ingest first (the series payload read), then import the
  // production rows + one planted orphan through the seam.
  w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const rows = FX.bible.listens.map((r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source }));
  rows.push({ series: 'bible-in-a-year', seqKey: 'biy:day-999', listenDate: '2026-11-12', source: 'seed' });
  const imp = await w.__local('/api/player/podcasts/import-listens', { method: 'POST', body: JSON.stringify({ rows }) }, 'device');
  check('C3 the 322 production rows land whole; the orphan is refused', imp.landed === 322 && imp.refused === 1, imp);
  const out = w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const byKey = Object.fromEntries(out.entries.map((e) => [e.key, e]));
  check('C3 core count reads 322 and total 372', out.listenedCount === 322 && out.total === 372, { c: out.listenedCount, t: out.total });
  check('C3 current derives to Day 322', out.currentKey === 'biy:day-322', out.currentKey);
  check('C3 Days 1-321 + the bonus stand listened; Day 322 does not', byKey['biy:day-1'].listened === true && byKey['biy:day-321'].listened === true && byKey['biy:bonus-if-you-feel-like'].listened === true && byKey['biy:day-322'].listened === false);
  check('C3 the orphan key is applied nowhere', out.entries.every((e) => e.key !== 'biy:day-999') && !w.__core().listens['bible-in-a-year|biy:day-999']);
  const idx = w.__fold(JSON.parse(JSON.stringify(bibleIndex())));
  check('C1 the index view reads the same core (322 · Day 322)', idx.seriesList[0].listenedCount === 322 && idx.seriesList[0].currentKey === 'biy:day-322' && idx.seriesList[0].currentLabel === 'Day 322', idx.seriesList[0]);
  // C2 cross-view: mark Day 322 through the local route.
  await w.__local('/api/player/podcasts/mark', { method: 'POST', body: JSON.stringify({ series: 'bible-in-a-year', seqKey: 'biy:day-322', source: 'manual' }) }, 'device');
  const out2 = w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const idx2 = w.__fold(JSON.parse(JSON.stringify(bibleIndex())));
  check('C2 a route mark shows in series + index views (323 · Day 323)', out2.listenedCount === 323 && out2.currentKey === 'biy:day-323' && idx2.seriesList[0].listenedCount === 323, { s: out2.listenedCount, i: idx2.seriesList[0].listenedCount });
  const w2 = makeWorld(store); // reload over the same store
  const out3 = w2.__fold(JSON.parse(JSON.stringify(biblePayload())));
  check('C2 the mark survives a reload (the core persists)', out3.listenedCount === 323 && out3.entries.filter((e) => e.key === 'biy:day-322')[0].listened === true);
  await w2.__local('/api/player/podcasts/unmark', { method: 'POST', body: JSON.stringify({ series: 'bible-in-a-year', seqKey: 'biy:day-322' }) }, 'device');
  const out4 = w2.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const idx4 = w2.__fold(JSON.parse(JSON.stringify(bibleIndex())));
  check('C2 unmark clears every view (322)', out4.listenedCount === 322 && idx4.seriesList[0].listenedCount === 322 && out4.entries.filter((e) => e.key === 'biy:day-322')[0].listened === false);
}

// ---------- C1 RSS + own + novena kinds ----------
{
  const store = {};
  const w = makeWorld(store);
  const ex = FX.exorcist;
  const exPayload = () => ({ ok: true, kind: 'rss', series: ex.series, title: ex.title, available: true, entries: stripped(ex.entries), currentKey: ex.entries[0].key, listenedCount: 0, total: ex.entries.length });
  w.__fold(JSON.parse(JSON.stringify(exPayload())));
  const rows = ex.listens.map((r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source }));
  const imp = await w.__local('/api/player/podcasts/import-listens', { method: 'POST', body: JSON.stringify({ rows }) }, 'device');
  const out = w.__fold(JSON.parse(JSON.stringify(exPayload())));
  const marked = out.entries.filter((e) => e.listened).map((e) => e.key).sort();
  check('C1 RSS kind: GUID-keyed marks land on their own episodes; count agrees', imp.landed === 3 && out.listenedCount === 3 && JSON.stringify(marked) === JSON.stringify(rows.map((r) => r.seqKey).sort()), { marked, c: out.listenedCount });
  check('C1 RSS kind: current stays the latest entry (no day derivation)', out.currentKey === ex.entries[0].key, out.currentKey);
  const cat = FX.catechism;
  const catPayload = () => ({ ok: true, series: cat.series, title: cat.title, available: true, entries: stripped(cat.entries), currentKey: null, listenedCount: 0, total: cat.entries.length });
  w.__fold(JSON.parse(JSON.stringify(catPayload())));
  await w.__local('/api/player/podcasts/import-listens', { method: 'POST', body: JSON.stringify({ rows: cat.listens.map((r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source })) }) }, 'device');
  const catOut = w.__fold(JSON.parse(JSON.stringify(catPayload())));
  check('C1 sequence kind (Catechism): its mark lands; count + current agree', catOut.listenedCount === 1 && catOut.entries.filter((e) => e.key === 'ciy:day-1')[0].listened === true && catOut.currentKey === 'ciy:day-2', { c: catOut.listenedCount, cur: catOut.currentKey });
  const own = FX.own;
  const ownOut = w.__fold({ ok: true, kind: 'own', series: own.series, title: own.title, available: true, entries: stripped(own.entries), currentKey: own.entries[0].key, listenedCount: 0, total: own.entries.length });
  check('C1 own kind: identity ingests; entries gain a definite unlistened state; no phantom marks', ownOut.entries.every((e) => e.listened === false) && ownOut.listenedCount === 0 && !!w.__core().series['the-ai-signal']);
  const novOut = w.__fold({ ok: true, kind: 'novena', series: 'novena-st-andrew', title: 'St. Andrew Novena', available: true, entries: [{ key: '2025-11-30-st-andrew-day-1', title: 'Day 1', url: 'https://x/n1.mp3', durationS: 300 }], listenedCount: 0, total: 1 });
  check('C1 novena kind: identity ingests; the entry gains a definite unlistened state', novOut.entries[0].listened === false && novOut.listenedCount === 0);
}

// ---------- C4 legacy migration ----------
{
  const store = {};
  const w = makeWorld(store);
  w.__save({
    listens: {
      'bible-in-a-year|biy:day-317': { listenDate: '2026-11-14', listenedAt: '2026-11-14T15:00:00.000Z', source: 'auto' },
      'bible-in-a-year|biy:day-999': { listenDate: '2026-11-14', listenedAt: '2026-11-14T15:00:00.000Z', source: 'auto' },
    },
    positions: { 'bible-in-a-year|biy:day-318': { positionS: 42, durationS: 1500 } },
    dayPositions: { 'some-episode|2026-11-21': { positionS: 5, durationS: 100 } },
  });
  const payload = { ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true, entries: [316, 317, 318].map((d) => ({ key: 'biy:day-' + d, kind: 'day', day: d, label: 'Day ' + d, title: 'T' + d, url: 'https://x/' + d + '.mp3', durationS: 1500 })), currentKey: null, listenedCount: 0, total: 3 };
  const out = w.__fold(JSON.parse(JSON.stringify(payload)));
  const byKey = Object.fromEntries(out.entries.map((e) => [e.key, e]));
  const core = w.__core();
  check('C4 legacy listens move into the core and paint', core.migration.fromPlaybackV1.movedListens === 2 && byKey['biy:day-317'].listened === true && byKey['biy:day-316'].listened === false, core.migration.fromPlaybackV1);
  check('C4 the legacy position lands on its own episode', byKey['biy:day-318'].positionS === 42, byKey['biy:day-318']);
  check('C4 the orphan drops at ingest and is counted', (core.migration.dropped || []).includes('bible-in-a-year|biy:day-999') && !core.listens['bible-in-a-year|biy:day-999'], core.migration.dropped);
  const legacy = JSON.parse(store['opn-playback-local-v1'] || '{}');
  check('C4 the legacy store keeps only its day-form positions', Object.keys(legacy.listens || {}).length === 0 && Object.keys(legacy.positions || {}).length === 0 && !!legacy.dayPositions['some-episode|2026-11-21'], legacy);
}

// ---------- R: the restore bridge (fix-forward) ----------
// A device world: the public shape standing in the shell,
// so opnMode() reads 'device' and the personal-data layer
// runs its on-device path — the same world John's phone
// restores the prepared file in.
function deviceWorld(store) {
  const w = makeWorld(store);
  vm.runInContext("this.window = { __OPN_SHAPE__: 'public' }; this.oraInShell = function () { return true; };", w);
  return w;
}
{
  const store = {};
  const w = deviceWorld(store);
  // Ingest the Bible series first (its payload read), so
  // the registry stands when the restore's rows arrive.
  w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  // The file's section: 331 rows — the fixture's 326
  // (Bible 322 · Exorcist 3 · Catechism 1) + 4 of the
  // prepared file's rows for series the fixture does not
  // snapshot (they land pending, as they do on the phone)
  // — plus one planted orphan.
  const seamRow = (r) => ({ series: r.series, seqKey: r.seq_key, listenDate: r.listen_date, source: r.source });
  const rows = [
    ...FX.bible.listens.map(seamRow),
    { series: 'bible-in-a-year', seqKey: 'biy:day-999', listenDate: '2026-11-12', source: 'seed' },
    ...FX.exorcist.listens.map(seamRow),
    ...FX.catechism.listens.map(seamRow),
    { series: 'daily-gospel-exegesis', seqKey: '31a8328a-106e-4250-8306-9e6cd0ae6289', listenDate: '2026-11-18', source: 'auto' },
    { series: 'daily-gospel-exegesis', seqKey: 'f12a7182-b6fc-4de4-a0b8-e7c2a49c0e3b', listenDate: '2026-11-20', source: 'auto' },
    { series: 'counsel-of-trent', seqKey: 'tag:soundcloud,2010:tracks/2430746307', listenDate: '2026-11-20', source: 'auto' },
    { series: 'barron-sunday-sermons', seqKey: 'wordonfire.podbean.com/c11d6ced-8e84-3e34-97ca-50685123df75', listenDate: '2026-11-17', source: 'auto' },
  ];
  check('R1 the fixture section carries 331 rows', rows.length === 331, rows.length);
  const file = {
    format: 'orapronobis-personal-data', formatVersion: 1, exportedAt: '2026-11-21T18:00:00.000Z',
    sections: { intentions: [{ id: 1, text: 'fixture intention', level: 'medium', active: true, createdAt: '2026-11-01' }] },
    podcastListens: rows,
  };
  const counts = await w.__restore(JSON.stringify(file));
  check('R1 the restore consumes the podcastListens section (330 land; the orphan refused + counted)', !!counts.podcastListens && counts.podcastListens.landed === 330 && counts.podcastListens.refused === 1, counts.podcastListens);
  const core = w.__core();
  const bibleInCore = Object.keys(core.listens).filter((k) => k.indexOf('bible-in-a-year|') === 0);
  check('R1 322 Bible in a Year listens stand in the core; the orphan is nowhere', bibleInCore.length === 322 && !core.listens['bible-in-a-year|biy:day-999'], bibleInCore.length);
  const out = w.__fold(JSON.parse(JSON.stringify(biblePayload())));
  const byKey = Object.fromEntries(out.entries.map((e) => [e.key, e]));
  check('R1 the series view reads count 322 · current Day 322 from the core', out.listenedCount === 322 && out.currentKey === 'biy:day-322', { c: out.listenedCount, cur: out.currentKey });
  check('R1 the rows paint: Days 1-321 + the bonus listened, Day 322 not', byKey['biy:day-1'].listened === true && byKey['biy:day-321'].listened === true && byKey['biy:bonus-if-you-feel-like'].listened === true && byKey['biy:day-322'].listened === false);
  check('R1 the personal document restores as before (its counts stand)', counts.intentions === 1 && counts.profiles >= 1, counts);
}
{
  const store = {};
  const w = deviceWorld(store);
  const file = {
    format: 'orapronobis-personal-data', formatVersion: 1, exportedAt: '2026-11-21T18:00:00.000Z',
    sections: { intentions: [{ id: 1, text: 'fixture intention', level: 'medium', active: true, createdAt: '2026-11-01' }] },
  };
  const counts = await w.__restore(JSON.stringify(file));
  check('R2 a file without the section restores exactly as today (no listens land, no outcome rides)', counts.podcastListens === undefined && counts.intentions === 1 && Object.keys(w.__core().listens).length === 0, counts);
}

console.log('harness-v589:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
