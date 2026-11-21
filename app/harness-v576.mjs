// harness-v576.mjs — v576 Grouped Favorites verification.
//
// S-legs (static, against the BASE tree):
//   S1 the diff vs BASE is confined to app/worker/src/client.ts,
//      app/worker/src/index.ts, app/worker/src/ui.ts and this
//      harness.
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (no migration — starred entries are whole JSON).
//   S3 the SW pin is unmoved vs BASE pre-Ship (the pin moves
//      only in the Ship commit, to ora-pro-nobis-v576-1).
//   S4 the v576 surface strings stand in client.ts (the four
//      default folder names, New folder, Move to, the
//      collapse key, the series star seats, the sweep).
//   S5 index.ts: the starred PUT accepts the series/folder
//      kinds and starKeyOfEntry carries both key forms.
//   S6 THE SERVED CLIENT PARSES: the APP_JS template, rendered
//      exactly as the Worker serves it, compiles whole.
//      (Standing lesson, 2026-11-21: harnesses run the
//      RENDERED client, never the raw source.)
//
// L-legs (the REAL code in Node vm worlds over slices of the
// RENDERED client — the v568 layer slice, the star-machinery
// slice, the v576 folder slice; DOM painters and menus are
// stubbed at their seams, the row painters are standing code
// proven by their own releases):
//   L1 folder derivation + partition: a day episode lands in
//      Praylist · a Novenas episode in Catechesis · a podcast
//      episode in Catechesis, never Podcasts (Q4 C + Q1 B) ·
//      a series door in Podcasts · an explicit folder wins.
//   L2 the series star: starEntryForKey resolves a door from
//      the index payload; toggleStar stands it in the store
//      and the layer's own read returns it (the layer PUT
//      validation accepts the series kind end to end); a
//      second toggle removes it.
//   L3 the Prayers folder (Q3 A): the book favorites are its
//      content; the prayer row stands with its play disc;
//      prayerAudioDesc builds the audio URL.
//   L4 the reset sweep (Q6 B form): a Praylist entry dated
//      yesterday drops and the drop persists through the
//      standing sync · the same entry moved to a custom
//      folder survives · Catechesis entries dated yesterday
//      survive · a dateless entry survives · a door survives.
//   L5 folder acts: New folder mints the definition and the
//      store carries it · Move writes the assignment and it
//      rides the store · moving home clears it · Delete
//      returns items to their derived folders.
//   L6 collapse: expanded by default; the toggle persists to
//      the device key and reads back.
//   L7 layer validation: series/folder kinds accepted; a bad
//      kind refused; an entry's folder field round-trips.
//   L8 web mode: the sweep never runs (the layer's list
//      stands empty there and its writes are refused).
//   L9 Play all exclusion: starredDescFor builds nothing for
//      a series door or a folder definition.
//
// Fixtures (Improvement D): entry snapshots carry the fields
// starEntryForDesc builds from live descriptors; the series
// fixture carries the live /api/player/podcasts index fields
// (series · title · showImageUrl · kind · category); the
// book fixture uses the live book slug our-father with its
// audio fold form.
//
// Run: node harness-v576.mjs [BASE_SHA]
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
const allowed = new Set(['worker/src/client.ts', 'worker/src/index.ts', 'worker/src/ui.ts', 'harness-v576.mjs']);
check('S1 diff confined to client.ts + index.ts + ui.ts + harness-v576.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S2 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
check('S4 default folder names stand', ['Favorite Praylist', 'Favorite Catechesis', 'Favorite Prayers', 'Favorite Podcasts'].every((n) => clientSrc.includes(n)));
check('S4 folder acts stand', clientSrc.includes('New folder') && clientSrc.includes("'Move to ' + f.name") && clientSrc.includes("FAV_COLLAPSE_KEY = 'opn-favcollapse-v576'"));
check('S4 series star seats + sweep stand', clientSrc.includes('function seriesStarBtnHtml') && clientSrc.includes('function seatSeriesStar') && clientSrc.includes('function favPraylistSweep'));
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
check('S5 server PUT accepts series + folder kinds', indexSrc.includes('e.k !== "series" && e.k !== "folder"'));
check('S5 server key builder carries both forms', indexSrc.includes('if (e.k === "series") return "series:"') && indexSrc.includes('if (e.k === "folder") return "folder:"'));

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
const folderText = slice('   v576 — Grouped Favorites (John', 'function paintFavoritesPage(day) {');
// the folder slice opens mid-comment; prepend the comment opener
const folderBlock = '/* ============================================================\n' + folderText;

const TODAY = '2026-11-21', YDAY = '2026-11-20';
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
  // stubs at the DOM/menu seams + the client state fixture
  vm.runInContext(`
    var state = {
      starred: [], bookFavs: [], book: null, podcasts: null,
      podcastsIndex: { seriesList: [
        { series: 'bible-in-a-year', title: 'Bible in a Year', showImageUrl: 'https://img/biy.png', kind: 'rss', category: 'podcasts' },
        { series: 'catechism-in-a-year', title: 'Catechism in a Year', showImageUrl: '', kind: 'rss', category: 'courses' }
      ]},
      dayDescs: [], ownSlots: null, dayPayload: { date: '${TODAY}' }, presentedDay: '${TODAY}',
      readTracks: {}, trackDraws: null, current: null, tab: 'prayers', prayersView: { kind: 'favorites' }
    };
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
  vm.runInContext(starText + '\n' + descText + '\n' + prayerDescText + '\n' + favListText + '\n' + folderBlock, world);
  vm.runInContext('this.__x = { state, api, starKeyOf, starEntryKey, starredHas, starredEntryByKey, starEntryForKey, toggleStar, starredSet, starredDescFor, favoritesList, prayerAudioDesc, favFolders, favFolderOf, favDerivedFolder, favTracksIn, favDoorsIn, favCollapsed, favToggleCollapse, favPraylistSweep, favMoveToFolder, favCreateFolder, favRenameFolder, favDeleteFolder, favFolderSectionHtml, bookFavsList };', world);
  return world;
}
const tick = () => new Promise((r) => setImmediate(r));
async function settle() { await tick(); await tick(); await tick(); }

// fixture entries — the starEntryForDesc snapshot fields
const epDay = { k: 'episode', id: 'day-ep-1', title: 'Morning Psalm', sub: 'Morning Prayer', durationS: 300, imageUrl: '', block: 'Morning Prayer', url: 'https://x/1.mp3', date: TODAY };
const epDayOld = { k: 'episode', id: 'day-ep-old', title: 'Yesterday Psalm', sub: 'Morning Prayer', durationS: 200, imageUrl: '', block: 'Morning Prayer', url: 'https://x/2.mp3', date: YDAY };
const epNovena = { k: 'episode', id: 'nov-ep-1', title: 'Novena Day 3', sub: 'Novenas', durationS: 400, imageUrl: '', block: 'Novenas', url: 'https://x/3.mp3', date: YDAY };
const epPod = { k: 'podcast', id: 'ep-42', series: 'bible-in-a-year', title: 'Day 42: Exodus', sub: 'Bible in a Year', durationS: 1200, imageUrl: '', block: 'Podcasts', url: 'https://x/4.mp3', date: YDAY };
const epNoDate = { k: 'episode', id: 'day-ep-nodate', title: 'Dateless', sub: 'Evening', durationS: 100, imageUrl: '', block: 'Evening', url: 'https://x/5.mp3', date: '' };
const door = { k: 'series', id: 'bible-in-a-year', title: 'Bible in a Year', sub: 'Podcast', durationS: 0, imageUrl: 'https://img/biy.png', block: '', url: null, date: YDAY };

{ // L1 + L2 + L7 in one device world
  const W = makeWorld(true);
  const X = W.__x;
  const put = (starred) => X.api('/api/prayer/starred', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred }) });
  const seed = [epDay, epDayOld, epNovena, epPod, epNoDate, door];
  const res = await put(seed);
  check('L7 layer PUT accepts the standing kinds + the series kind', res && Array.isArray(res.starred) && res.starred.length === 6, res && res.starred && res.starred.length);
  X.starredSet(res.starred);
  check('L1 folders stand in order', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['praylist', 'catechesis', 'prayers', 'podcasts']), X.favFolders());
  check('L1 day episode derives Praylist', X.favFolderOf(epDay) === 'praylist');
  check('L1 Novenas episode derives Catechesis', X.favFolderOf(epNovena) === 'catechesis');
  check('L1 podcast episode derives Catechesis, never Podcasts (Q4 C + Q1 B)', X.favFolderOf(epPod) === 'catechesis');
  check('L1 series door derives Podcasts', X.favFolderOf(door) === 'podcasts');
  check('L1 partition: Praylist holds the day episodes', JSON.stringify(X.favTracksIn('praylist').map((e) => e.id)) === JSON.stringify(['day-ep-1', 'day-ep-old', 'day-ep-nodate']));
  check('L1 partition: Catechesis holds novena + podcast episodes', JSON.stringify(X.favTracksIn('catechesis').map((e) => e.id)) === JSON.stringify(['nov-ep-1', 'ep-42']));
  check('L1 partition: Podcasts holds the door, no episodes', X.favDoorsIn('podcasts').length === 1 && X.favTracksIn('podcasts').length === 0);
  check('L1 favoritesList carries tracks only', X.favoritesList().length === 5 && X.favoritesList().every((e) => e.k === 'episode' || e.k === 'podcast'));
  // L2 the series star
  const entry = X.starEntryForKey('series:catechism-in-a-year');
  check('L2 series key resolves a door from the index payload', !!entry && entry.k === 'series' && entry.title === 'Catechism in a Year', entry);
  X.toggleStar(entry);
  await settle();
  check('L2 toggle stands the door in the store', X.starredHas('series:catechism-in-a-year'));
  const read = await X.api('/api/prayer/starred');
  check('L2 the layer read returns the door (validation end to end)', (read.starred || []).some((e) => e.k === 'series' && e.id === 'catechism-in-a-year'), read.starred && read.starred.map((e) => e.k));
  X.toggleStar(X.starEntryForKey('series:catechism-in-a-year'));
  await settle();
  check('L2 second toggle removes the door', !X.starredHas('series:catechism-in-a-year'));
  // L7 refusals + folder field round-trip
  let refused = false;
  try { await put([{ k: 'bogus', id: 'x', title: 'X' }]); } catch (e) { refused = true; }
  check('L7 a bad kind is refused', refused);
  const withFolder = Object.assign({}, epDay, { folder: 'catechesis' });
  const res2 = await put([withFolder]);
  check('L7 an explicit folder wins over derivation + round-trips the store', res2.starred[0].folder === 'catechesis' && X.favFolderOf(res2.starred[0]) === 'catechesis', res2.starred[0]);
}

{ // L3 the Prayers folder
  const W = makeWorld(true);
  const X = W.__x;
  X.state.book = { groups: [{ category: 'Foundations', prayers: [{ slug: 'our-father', title: 'Our Father', body: 'Our Father...', audio: { en: 25, la: 27 } }] }] };
  await X.api('/api/prayer/book/favorites', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: ['our-father'] }) });
  X.state.bookFavs = ['our-father'];
  const html = X.favFolderSectionHtml({ id: 'prayers', name: 'Favorite Prayers', custom: false });
  check('L3 Prayers folder section stands with its count', html.includes('Favorite Prayers') && html.includes('data-favprayerplay="our-father"'), html.slice(0, 200));
  const f = { prayer: X.state.book.groups[0].prayers[0] };
  const d = X.prayerAudioDesc(f.prayer, 'en');
  check('L3 the prayer row play builds the audio descriptor', !!d && d.url === '/api/prayer/book/audio/our-father/en' && d.available === true, d);
}

{ // L4 the sweep + L5 folder acts + L6 collapse
  const W = makeWorld(true);
  const X = W.__x;
  const put = (starred) => X.api('/api/prayer/starred', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred }) });
  const res = await put([epDayOld, epNovena, epPod, epNoDate, door]);
  X.starredSet(res.starred);
  check('L4 sweep reports the drop', X.favPraylistSweep() === true);
  await settle();
  const read = await X.api('/api/prayer/starred');
  const ids = (read.starred || []).map((e) => e.id);
  check('L4 yesterday Praylist entry dropped + persisted', !ids.includes('day-ep-old'), ids);
  check('L4 Catechesis entries dated yesterday survive', ids.includes('nov-ep-1') && ids.includes('ep-42'), ids);
  check('L4 dateless entry survives', ids.includes('day-ep-nodate'), ids);
  check('L4 the door survives', ids.includes('bible-in-a-year'), ids);
  // L5: move yesterday's praylist kind into a custom folder BEFORE the sweep
  const res2 = await put([epDayOld]);
  X.starredSet(res2.starred);
  X.favCreateFolder('Keepers');
  await settle();
  const def = X.favFolders().filter((f) => f.custom)[0];
  check('L5 New folder mints the definition', !!def && def.name === 'Keepers', X.favFolders());
  const target = X.state.starred.filter((e) => e.id === 'day-ep-old')[0];
  X.favMoveToFolder(target, def.id);
  await settle();
  const read2 = await X.api('/api/prayer/starred');
  const moved = (read2.starred || []).filter((e) => e.id === 'day-ep-old')[0];
  check('L5 Move writes the assignment and it rides the store', !!moved && moved.folder === def.id, moved);
  check('L5 Q6 B: the moved Praylist item no longer resets', X.favPraylistSweep() === false && X.state.starred.some((e) => e.id === 'day-ep-old'));
  X.favMoveToFolder(moved, 'praylist');
  await settle();
  const read3 = await X.api('/api/prayer/starred');
  const homed = (read3.starred || []).filter((e) => e.id === 'day-ep-old')[0];
  check('L5 moving home clears the assignment', !!homed && !('folder' in homed), homed);
  X.favMoveToFolder(homed, def.id);
  X.favDeleteFolder(def.id);
  await settle();
  const read4 = await X.api('/api/prayer/starred');
  const after = (read4.starred || []).filter((e) => e.id === 'day-ep-old')[0];
  check('L5 Delete returns items to their derived folders', !!after && !('folder' in after) && !X.favFolders().some((f) => f.id === def.id), after);
  // L6 collapse
  check('L6 folders stand expanded by default', X.favCollapsed('praylist') === false);
  X.favToggleCollapse('praylist');
  check('L6 the toggle persists to the device key', X.favCollapsed('praylist') === true && (W.__storage.get('opn-favcollapse-v576') || '').includes('praylist'), W.__storage.get('opn-favcollapse-v576'));
  X.favToggleCollapse('praylist');
  check('L6 the second toggle expands again', X.favCollapsed('praylist') === false);
}

{ // L8 web mode + L9 play exclusion
  const W = makeWorld(false);
  const X = W.__x;
  X.starredSet([epDayOld]);
  check('L8 web mode: the sweep never runs', X.favPraylistSweep() === false && X.state.starred.length === 1);
  const read = await X.api('/api/prayer/starred');
  check('L8 web mode: the layer reads empty', Array.isArray(read.starred) && read.starred.length === 0, read);
  check('L9 no descriptor stands for a door', X.starredDescFor(door) === null);
  check('L9 no descriptor stands for a folder definition', X.starredDescFor({ k: 'folder', id: 'f1', title: 'F' }) === null);
}

console.log('harness-v576:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
