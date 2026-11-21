// harness-v581.mjs — v581 Favorite novenas (first-class
// favorite object) verification.
//
// S-legs (static, against the BASE tree):
//   S1 the diff vs BASE is confined to app/worker/src/
//      client.ts, app/worker/src/index.ts, this harness,
//      and harness-v576.mjs (its L1 folder-order pin moves
//      to five — the named change, §3 of the release doc).
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (no migration — the move is a derivation change).
//   S3 the SW pin is unmoved vs BASE pre-Ship (the pin
//      moves only in the Ship commit, to
//      ora-pro-nobis-v581-1).
//   S4 the v581 surface stands in client.ts (the fifth
//      folder name, the visible-folder derivation, the
//      novena standing helper, the novena- canon, the
//      settled all-empty line).
//   S5 index.ts: the novenas index payload carries the
//      start fields, computed from the Day-1 episode where
//      one stands, else the earliest episode.
//   S6 THE SERVED CLIENT PARSES: the APP_JS template,
//      rendered exactly as the Worker serves it, compiles
//      whole. (Standing lesson, 2026-11-21: harnesses run
//      the RENDERED client, never the raw source.)
//   S7 the Favorites paint reads the visible folders.
//
// L-legs (the REAL code in Node vm worlds over slices of
// the RENDERED client — the v568 layer slice, the star
// slice, the favorites slice, the folder slice, and
// novenaInfo; DOM painters and menus are stubbed at their
// seams, as in harness-v576):
//   L1 the defaults list carries FIVE folders in order.
//   L2 derivation (Q3 A): a novena door derives Favorite
//      Novenas · a podcast door derives Favorite Podcasts
//      · a standing assignment governs over derivation (a
//      novena door the user moved stays where it stands).
//   L3 the page list (the visible folders painted through
//      the section painter — the page's own construction):
//      the novena door stands under Favorite Novenas and
//      NOT under Favorite Podcasts · empty defaults
//      (Catechesis, Prayers) render no section.
//   L4 the novena object (Q2 A): "Day n today" from the
//      day-slot fixture · "Starts <label>" from the
//      catalog fixture with no slot · "Novena" with
//      neither · the door row never reads Podcast.
//   L5 empty folders (John's added rule): an empty custom
//      folder is invisible and counts 0 · the Move menu
//      still offers it · the all-empty world has no
//      visible folders · a one-item folder renders.
//   L6 server leg: podNovenasIndexPayload's own text
//      (its catalog dependency stubbed at the seam) over a
//      fixture catalog — startDate/startLabel name the
//      Day-1 date where a Day 1 stands, the earliest
//      episode's date where none does.
//
// Fixtures (Improvement D): the novena door entry carries
// the fields starEntryForKey builds from the live catalog
// (v577's resolution, production catalog of 2026-11-21);
// the catalog fixture rides the live ?series=novenas
// payload shape (key · slug · name · saint · total ·
// latestDate/latestLabel · startDate/startLabel); the
// slot fixture rides the day resolution's track shape
// (episodeId 'novena-<slug>' + a title carrying "Day 7",
// the feed's standing title form).
//
// Run: node harness-v581.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || 'origin/main';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8' });

// ---------- S-legs ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean)
  .map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/client.ts', 'worker/src/index.ts', 'harness-v581.mjs', 'harness-v576.mjs', 'harness-v579.mjs']);
check('S1 diff confined to client.ts + index.ts + harness-v581.mjs + harness-v576.mjs + harness-v579.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S2 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
check('S4 fifth folder + visible derivation stand', clientSrc.includes("'Favorite Novenas'") && clientSrc.includes('function favVisibleFolders()') && clientSrc.includes('function favFolderCount(folderId)'));
check('S4 novena standing + canon stand', clientSrc.includes('function favNovenaStanding(e)') && clientSrc.includes("indexOf('novena-') === 0") && clientSrc.includes("'Day ' + hit.n + ' today'") && clientSrc.includes("'Starts ' + nrow.startLabel"));
check('S4 settled all-empty line stands', clientSrc.includes('No favorites yet') && clientSrc.includes('or a novena and it will stand here'));
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
check('S5 payload carries the start fields', indexSrc.includes('startDate: start ? start.date : null') && indexSrc.includes('startLabel: start ? start.label : null'));
check('S5 start = Day 1 where one stands, else the earliest', indexSrc.includes('e.dayN === 1') && indexSrc.includes('n.episodes[n.episodes.length - 1]'));
check('S7 the Favorites paint reads the visible folders', clientSrc.includes('visibleFolders.map(favFolderSectionHtml)'));

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

// ---------- slices of the rendered client ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const layerStart = appJs.indexOf('/* ---------------- v568: local personal data');
const layerEnd = appJs.indexOf('function api(path, opts) {');
const apiEnd = appJs.indexOf('function post(path, body)');
if (layerStart < 0 || layerEnd < 0 || apiEnd < 0) { console.log('not ok - layer slice markers'); process.exit(1); }
const layerText = appJs.slice(layerStart, layerEnd) + appJs.slice(layerEnd, apiEnd);
const starText = slice('function starKeyOf(kind, id, series) {', 'function refreshStarChrome()');
const favListText = slice('function favoritesList() {', 'function paintFavoritesFolderRow()');
const descText = slice('function starredDescFor(entry) {', 'var favPodListened = {}');
const prayerDescText = slice('function prayerAudioDesc(p, lang) {', '/* v508: the book body paints');
const novenaInfoText = slice('function novenaInfo(episodeId, title) {', 'function novenaLineText');
const folderText = slice('   v576 — Grouped Favorites (John', 'function paintFavoritesPage(day) {');
const folderBlock = '/* ============================================================\n' + folderText;

const TODAY = '2026-11-21';
function makeWorld(inShell) {
  const storage = new Map();
  const world = {
    console, URLSearchParams,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder,
    setTimeout, clearTimeout,
    location: { host: 'app.orapronobis.media', pathname: '/', search: '', origin: 'https://app.orapronobis.media' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    fetch: () => Promise.reject(new Error('network must not be touched by the local layer')),
    __OPN_SHAPE__: 'public',
    __storage: storage,
  };
  world.window = world;
  world.window.__OPN_SHAPE__ = 'public';
  world.oraInShell = () => inShell;
  world.todayChicago = () => TODAY;
  world.__shape = 'public';
  vm.createContext(world);
  vm.runInContext('window.__OPN_SHAPE__ = __shape;', world);
  vm.runInContext(layerText, world);
  vm.runInContext(`
    var state = {
      starred: [], bookFavs: [], book: null, podcasts: null, novenasCatalog: null,
      podcastsIndex: { seriesList: [
        { series: 'bible-in-a-year', title: 'Bible in a Year', showImageUrl: 'https://img/biy.png', kind: 'rss', category: 'podcasts' }
      ]},
      dayDescs: [], ownSlots: null, dayPayload: { date: '${TODAY}' }, presentedDay: '${TODAY}',
      readTracks: {}, trackDraws: null, current: null, tab: 'prayers', prayersView: { kind: 'favorites' }
    };
    var BS_CH = String.fromCharCode(92);
    var presentedDateStr = function () { return '${TODAY}'; };
    var playedMap = function () { return {}; };
    var esc = function (s) { return String(s == null ? '' : s); };
    var fmtDur = function (s) { return Math.round(s / 60) + ' min'; };
    var fmtDurLong = fmtDur;
    var bookFind = function (slug) {
      var groups = (state.book && state.book.groups) || [];
      for (var i = 0; i < groups.length; i++) for (var j = 0; j < (groups[i].prayers || []).length; j++)
        if (groups[i].prayers[j].slug === slug) return { prayer: groups[i].prayers[j], category: groups[i].category };
      return null;
    };
    var bookFavsList = function () { return Array.isArray(state.bookFavs) ? state.bookFavs : []; };
    var toggleBookFav = function (slug) { var f = bookFavsList().slice(); var at = f.indexOf(slug); if (at >= 0) f.splice(at, 1); else f.push(slug); state.bookFavs = f; };
    var podDesc = function (e) { return { episodeId: e.key, seriesKey: e.key, kind: 'podcast', podSeries: e.series || '', title: e.title || '', url: e.url || '', available: !!e.url, block: 'Podcasts', durationS: e.durationS || 0, imageUrl: '' }; };
    var podOwnDesc = podDesc;
    var trackDesc = function () { return null; };
    var ownSlotTrack = function () { return null; };
    var catechesisNovenasRow = function () { return null; };
    var refreshStarChrome = function () {};
    var paintFavoritesSurfaces = function () {};
    var openSheetMenu = function () {};
    var openPrayerPage = function () {};
    var goSeries = function () {};
    var mountDrawer = function () {};
    var starredRowHtml = function (e) { return '<row:' + (e.k) + ':' + (e.id) + '>'; };
    var rowArtHtml = function (a, disc) { return '<art>' + (disc || ''); };
    this.__x = null;
  `, world);
  vm.runInContext(starText + '\n' + descText + '\n' + prayerDescText + '\n' + favListText + '\n' + novenaInfoText + '\n' + folderBlock, world);
  vm.runInContext('this.__x = { state, api, starEntryKey, starredHas, starredSet, favoritesList, favFolders, favVisibleFolders, favFolderCount, favFolderOf, favDerivedFolder, favTracksIn, favDoorsIn, favIsNovenaDoor, favNovenaStanding, favDoorRowHtml, favFolderSectionHtml, favMoveItems, favCreateFolder, bookFavsList };', world);
  return world;
}
const tick = () => new Promise((r) => setImmediate(r));
async function settle() { await tick(); await tick(); await tick(); }

// fixture entries — the shapes the standing code builds
const epDay = { k: 'episode', id: 'day-ep-1', title: 'Morning Psalm', sub: 'Morning Prayer', durationS: 300, imageUrl: '', block: 'Morning Prayer', url: 'https://x/1.mp3', date: TODAY };
const podcastDoor = { k: 'series', id: 'bible-in-a-year', title: 'Bible in a Year', sub: 'Podcast', durationS: 0, imageUrl: 'https://img/biy.png', block: '', url: null, date: TODAY };
const novenaDoor = { k: 'series', id: 'novena-st_andrew_dung_lac', title: 'Novena to St. Andrew Dũng-Lạc', sub: 'Podcast', durationS: 0, imageUrl: '', block: '', url: null, date: TODAY };
const novenaDoorMoved = { k: 'series', id: 'novena-st_jude', title: 'Novena to St. Jude', sub: 'Podcast', durationS: 0, imageUrl: '', block: '', url: null, date: TODAY, folder: 'podcasts' };
const catalogFixture = { ok: true, kind: 'novenas', available: true, novenas: [
  { key: 'novena-st_andrew_dung_lac', slug: 'st_andrew_dung_lac', name: 'Novena to St. Andrew Dũng-Lạc', saint: 'St. Andrew Dũng-Lạc', total: 9, latestDate: '2026-11-23', latestLabel: 'November 23, 2026', startDate: '2026-11-15', startLabel: 'November 15, 2026' },
  { key: 'novena-st_jude', slug: 'st_jude', name: 'Novena to St. Jude', saint: 'St. Jude', total: 9, latestDate: '2026-10-28', latestLabel: 'October 28, 2026', startDate: '2026-10-20', startLabel: 'October 20, 2026' }
] };
const slotFixture = { novenas: { state: 'present', tracks: [
  { episodeId: 'novena-st_andrew_dung_lac', title: 'Novena to St. Andrew Dũng-Lạc Day 7 - November 21, 2026', state: 'present', enclosureUrl: 'https://x/n7.mp3', streamUrl: null, durationS: 400, sizeBytes: 0, imageUrl: '/logo.png' }
] } };

{ // L1 + L2 + L3 in one device world
  const W = makeWorld(true);
  const X = W.__x;
  check('L1 defaults carry five folders in order', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['praylist', 'catechesis', 'prayers', 'podcasts', 'novenas']), X.favFolders().map((f) => f.id));
  check('L2 novena door derives Favorite Novenas (Q3 A)', X.favFolderOf(novenaDoor) === 'novenas');
  check('L2 podcast door derives Favorite Podcasts', X.favFolderOf(podcastDoor) === 'podcasts');
  check('L2 a standing assignment governs over derivation', X.favFolderOf(novenaDoorMoved) === 'podcasts');
  check('L2 favIsNovenaDoor reads the canon', X.favIsNovenaDoor(novenaDoor) === true && X.favIsNovenaDoor(podcastDoor) === false);
  X.starredSet([epDay, podcastDoor, novenaDoor]);
  check('L3 partition: the novena door stands in Novenas, the podcast door in Podcasts',
    X.favDoorsIn('novenas').length === 1 && X.favDoorsIn('novenas')[0].id === 'novena-st_andrew_dung_lac'
    && X.favDoorsIn('podcasts').length === 1 && X.favDoorsIn('podcasts')[0].id === 'bible-in-a-year');
  check('L3 visible folders = the folders holding items', JSON.stringify(X.favVisibleFolders().map((f) => f.id)) === JSON.stringify(['praylist', 'podcasts', 'novenas']), X.favVisibleFolders().map((f) => f.id));
  const pageList = X.favVisibleFolders().map((f) => X.favFolderSectionHtml(f)).join('');
  const novenasSection = pageList.split('data-favfolder="novenas"')[1] || '';
  const podcastsSection = (pageList.split('data-favfolder="podcasts"')[1] || '').split('data-favfolder="novenas"')[0];
  check('L3 the page list carries the novena under Favorite Novenas', novenasSection.includes('Novena to St. Andrew') && pageList.includes('Favorite Novenas'));
  check('L3 the novena door does NOT stand under Favorite Podcasts', !podcastsSection.includes('novena-st_andrew_dung_lac') && podcastsSection.includes('Bible in a Year'));
  check('L3 empty defaults render no section', !pageList.includes('data-favfolder="catechesis"') && !pageList.includes('data-favfolder="prayers"'));
}

{ // L4 the novena object's standing line
  const W = makeWorld(true);
  const X = W.__x;
  X.starredSet([novenaDoor]);
  X.state.novenasCatalog = catalogFixture;
  check('L4 no slot: the standing is the start date', X.favNovenaStanding(novenaDoor) === 'Starts November 15, 2026', X.favNovenaStanding(novenaDoor));
  X.state.ownSlots = slotFixture;
  check('L4 slot standing: Day n today', X.favNovenaStanding(novenaDoor) === 'Day 7 today', X.favNovenaStanding(novenaDoor));
  const row = X.favDoorRowHtml(novenaDoor);
  check('L4 the door row carries the standing, never Podcast', row.includes('Day 7 today') && !row.includes('>Podcast<'), row.slice(0, 300));
  X.state.ownSlots = null; X.state.novenasCatalog = null;
  check('L4 neither load landed: the plain kind line', X.favNovenaStanding(novenaDoor) === 'Novena');
}

{ // L5 empty folders
  const W = makeWorld(true);
  const X = W.__x;
  check('L5 the all-empty world has no visible folders', X.favVisibleFolders().length === 0, X.favVisibleFolders());
  X.starredSet([epDay]);
  X.favCreateFolder('Keepers');
  await settle();
  const keepers = X.favFolders().filter((f) => f.custom)[0];
  check('L5 an empty custom folder counts 0 and stays invisible', !!keepers && X.favFolderCount(keepers.id) === 0 && !X.favVisibleFolders().some((f) => f.id === keepers.id));
  const labels = X.favMoveItems(epDay).map((i) => i.label);
  check('L5 the Move menu still offers the empty folder', labels.includes('Move to Keepers'), labels);
  X.starredSet([novenaDoor]);
  const section = X.favFolderSectionHtml({ id: 'novenas', name: 'Favorite Novenas', custom: false });
  check('L5 a one-item folder renders its door', section.includes('data-favdoor="novena-st_andrew_dung_lac"'), section.slice(0, 200));
}

// ---------- L6 the server payload (its own text, catalog stubbed) ----------
{
  const a = indexSrc.indexOf('async function podNovenasIndexPayload');
  const b = indexSrc.indexOf('async function podNovenaPayload', a + 1);
  if (a < 0 || b < 0) { console.log('not ok - payload slice markers'); process.exit(1); }
  const payloadText = indexSrc.slice(a, b).replace('(env: Env): Promise<unknown>', '(env)');
  const eps = (slug, days) => days.map(([date, dayN]) => ({ key: date + '-' + slug + '-day-' + dayN, guid: null, title: 't', date, dayN, label: 'LBL-' + date, url: 'https://x/' + date, durationS: 60 }));
  const catFixture = { builtAt: '2026-11-21T00:00:00Z', novenas: [
    { slug: 'with-day-one', name: 'Novena A', saint: 'A', episodes: eps('with-day-one', [['2026-11-23', 9], ['2026-11-20', 6], ['2026-11-15', 1]]) },
    { slug: 'no-day-one', name: 'Novena B', saint: 'B', episodes: eps('no-day-one', [['2026-11-10', 3], ['2026-11-09', 2]]) }
  ] };
  const world = { console };
  vm.createContext(world);
  vm.runInContext('var podNovenaCatalog = async function (env) { return { cat: __cat, stale: false }; };', world);
  world.__cat = catFixture;
  vm.runInContext(payloadText + '\n;this.__p = podNovenasIndexPayload;', world);
  const payload = await world.__p({});
  const na = payload.novenas.filter((n) => n.slug === 'with-day-one')[0];
  const nb = payload.novenas.filter((n) => n.slug === 'no-day-one')[0];
  check('L6 start = the Day-1 date where a Day 1 stands', na.startDate === '2026-11-15' && na.startLabel === 'LBL-2026-11-15', na);
  check('L6 start = the earliest episode date where no Day 1 stands', nb.startDate === '2026-11-09' && nb.startLabel === 'LBL-2026-11-09', nb);
}

console.log(`\n${ok} ok / ${bad} not ok`);
process.exit(bad ? 1 : 0);
