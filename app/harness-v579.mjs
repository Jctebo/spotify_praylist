// harness-v579.mjs — v579 Favorites reorder / expand-collapse
// all / remembered fold state verification.
//
// S-legs (static, against BASE):
//   S1 the diff vs BASE is confined to app/worker/src/client.ts,
//      app/worker/src/ui.ts and this harness.
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (no migration — order rides whole-JSON stores and
//      device-local UI keys).
//   S3 the SW pin is unmoved vs BASE pre-Ship (the pin moves
//      only in the Ship commit, to ora-pro-nobis-v579-1).
//   S4 the v579 surface stands in client.ts: the folder-order
//      key + reader/saver, Expand all / Collapse all and
//      their acts' names, the per-folder reorder machinery
//      (visible folders, availability, folder handle, items
//      container), the menu seats.
//   S5 ui.ts carries the folder-head handle dress.
//   S6 THE SERVED CLIENT PARSES: the APP_JS template, rendered
//      exactly as the Worker serves it, compiles whole.
//      (Standing lesson, 2026-11-21: harnesses run the
//      RENDERED client, never the raw source.)
//
// L-legs (the REAL code in Node vm worlds over slices of the
// RENDERED client — the v568 layer slice, the star-machinery
// slice, the v579 reorder slice, the v576 folder slice; DOM
// painters and menus are stubbed at their seams):
//   L1 folder order: a saved order sorts favFolders (named
//      first, unlisted follow standing order, dead ids drop
//      out); no key reads the standing order.
//   L2 expand/collapse all: collapse all folds every standing
//      folder into the collapse map; expand all clears it;
//      the any-collapsed / any-expanded reads agree.
//   L3 per-folder item reorder: Done splices a folder's
//      dragged order back into the positions that folder's
//      items already occupy — other folders' entries never
//      move — and the result persists through the standing
//      sync.
//   L4 folder reorder: Done writes the dragged folder order
//      to the device key and favFolders reads it back.
//   L5 the Prayers folder: its items are the book-favorite
//      slugs; Done rewrites the slug array in dragged order
//      through the book sync.
//   L6 visibility: an empty default folder is absent from
//      the mode; an empty custom folder stands (the page
//      paints it); availability needs two visible folders
//      or one folder with two items.
//   L7 the Praylist sweep is indifferent to order state: a
//      reordered yesterday entry still resets.
//   L8 the reorder rows: an item row carries its star key on
//      the row + the handle; a prayer row carries its
//      'prayer:<slug>' key.
//
// Fixtures (Improvement D): entry snapshots carry the fields
// starEntryForDesc builds from live descriptors (the v576
// harness fixtures, same production shapes); the book
// fixture uses live book slugs (our-father · memorare ·
// hail-mary) with the audio fold form.
//
// Run: node harness-v579.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || '175b857006bd17986c5ff0ad7d77cc2069dba378';
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
const allowed = new Set(['worker/src/client.ts', 'worker/src/ui.ts', 'harness-v579.mjs']);
check('S1 diff confined to client.ts + ui.ts + harness-v579.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S2 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
check('S4 folder-order key + machinery stand', clientSrc.includes("FAV_FOLDER_ORDER_KEY = 'opn-favfolderorder-v579'") && clientSrc.includes('function favFolderOrderSave') && clientSrc.includes('function favFolders()'));
check('S4 expand/collapse all stand', clientSrc.includes('function favExpandAll') && clientSrc.includes('function favCollapseAll') && clientSrc.includes("label: 'Expand all'") && clientSrc.includes("label: 'Collapse all'"));
check('S4 per-folder reorder machinery stands', clientSrc.includes('function favReorderVisibleFolders') && clientSrc.includes('function favReorderAvailable') && clientSrc.includes('data-favfolderhandle') && clientSrc.includes('data-favitems') && clientSrc.includes('function favReorderPrayerRowHtml'));
check('S5 ui.ts carries the folder-head handle dress', uiSrc.includes('.favfolder-head .favhandle'));

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
const reorderText = slice('/* v550 §2.4 (Q4 A): the reorder mode', '/* ============================================================\n   v576 — Grouped Favorites');
const folderText = slice('   v576 — Grouped Favorites (John', 'function paintFavoritesPage(day) {');
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
  vm.runInContext(`
    var state = {
      starred: [], bookFavs: [], book: null, podcasts: null,
      podcastsIndex: { seriesList: [] },
      dayDescs: [], ownSlots: null, dayPayload: { date: '${TODAY}' }, presentedDay: '${TODAY}',
      readTracks: {}, trackDraws: null, current: null, tab: 'prayers', prayersView: { kind: 'favorites' }
    };
    var esc = function (s) { return String(s == null ? '' : s); };
    var fmtDur = function (s) { return Math.round(s / 60) + ' min'; };
    var fmtDurLong = fmtDur;
    var shortDayLabel = function (d) { return d || ''; };
    var bookFind = function (slug) {
      var groups = (state.book && state.book.groups) || [];
      for (var i = 0; i < groups.length; i++) for (var j = 0; j < (groups[i].prayers || []).length; j++)
        if (groups[i].prayers[j].slug === slug) return { prayer: groups[i].prayers[j], category: groups[i].category };
      return null;
    };
    var bookFavsList = function () { return Array.isArray(state.bookFavs) ? state.bookFavs : []; };
    var __bookSyncs = 0;
    var bookFavsSet = function (favs) { state.bookFavs = favs; };
    var bookFavsSync = function () { __bookSyncs++; return Promise.resolve(null); };
    var toggleBookFav = function () {};
    var refreshStarChrome = function () {};
    var paintFavoritesSurfaces = function () {};
    var paintFavoritesPage = function () {};
    var openSheetMenu = function () {};
    var openPrayerPage = function () {};
    var goSeries = function () {};
    var mountDrawer = function () {};
    var starredRowHtml = function (e) { return '<row:' + (e.k) + ':' + (e.id) + '>'; };
    var rowArtHtml = function (a, disc) { return '<art>' + (disc || ''); };
    this.__x = null;
  `, world);
  vm.runInContext(starText + '\n' + favListText + '\n' + reorderText + '\n' + folderBlock, world);
  vm.runInContext('this.__x = { state, api, starEntryKey, starredSet, starredSync, favoritesList, favFolders, favFolderOf, favTracksIn, favDoorsIn, favCollapsed, favCollapseAll, favExpandAll, favAnyCollapsed, favAnyExpanded, favFolderOrderSave, favFolderOrderRead, favReorderVisibleFolders, favReorderAvailable, enterFavReorder, favReorderDone, favReorderRowHtml, favReorderPrayerRowHtml, favPraylistSweep, bookFavsList, get favReorder() { return favReorder; }, get bookSyncs() { return __bookSyncs; } };', world);
  return world;
}
const tick = () => new Promise((r) => setImmediate(r));
async function settle() { await tick(); await tick(); await tick(); }

// fixture entries — the starEntryForDesc snapshot fields
const epA = { k: 'episode', id: 'day-ep-1', title: 'Morning Psalm', sub: 'Morning Prayer', durationS: 300, imageUrl: '', block: 'Morning Prayer', url: 'https://x/1.mp3', date: TODAY };
const epB = { k: 'episode', id: 'day-ep-2', title: 'Morning Reading', sub: 'Morning Prayer', durationS: 240, imageUrl: '', block: 'Morning Prayer', url: 'https://x/2.mp3', date: TODAY };
const epOld = { k: 'episode', id: 'day-ep-old', title: 'Yesterday Psalm', sub: 'Morning Prayer', durationS: 200, imageUrl: '', block: 'Morning Prayer', url: 'https://x/9.mp3', date: YDAY };
const epPod = { k: 'podcast', id: 'ep-42', series: 'bible-in-a-year', title: 'Day 42: Exodus', sub: 'Bible in a Year', durationS: 1200, imageUrl: '', block: 'Podcasts', url: 'https://x/4.mp3', date: YDAY };
const door = { k: 'series', id: 'bible-in-a-year', title: 'Bible in a Year', sub: 'Podcast', durationS: 0, imageUrl: 'https://img/biy.png', block: '', url: null, date: YDAY };
const folderDef = { k: 'folder', id: 'fkeep', title: 'Keepers', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' };
const BOOK = { groups: [{ category: 'Foundations', prayers: [
  { slug: 'our-father', title: 'Our Father', body: 'Our Father...', audio: { en: 25, la: 27 } },
  { slug: 'memorare', title: 'Memorare', body: 'Remember...', audio: { en: 40 } },
  { slug: 'hail-mary', title: 'Hail Mary', body: 'Hail Mary...', audio: { en: 18 } },
] }] };

{ // L1 folder order + L2 expand/collapse all
  const W = makeWorld(true);
  const X = W.__x;
  X.starredSet([epA, folderDef]);
  check('L1 no order key reads the standing order', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['praylist', 'catechesis', 'prayers', 'podcasts', 'novenas', 'fkeep']), X.favFolders().map((f) => f.id)); // v581: the pin gains the fifth default (novenas, standing place)
  X.favFolderOrderSave(['podcasts', 'fkeep', 'praylist', 'catechesis', 'prayers']);
  check('L1 a saved order sorts the folder list', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['podcasts', 'fkeep', 'praylist', 'catechesis', 'prayers', 'novenas']), X.favFolders().map((f) => f.id)); // v581 pin
  X.favFolderOrderSave(['zzz-dead', 'prayers', 'praylist']);
  check('L1 dead ids drop out, unlisted follow standing order', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['prayers', 'praylist', 'catechesis', 'podcasts', 'novenas', 'fkeep']), X.favFolders().map((f) => f.id)); // v581 pin
  check('L2 folders stand expanded by default', X.favAnyExpanded() === true && X.favAnyCollapsed() === false);
  X.favCollapseAll();
  check('L2 collapse all folds every standing folder', X.favFolders().every((f) => X.favCollapsed(f.id)) && X.favAnyExpanded() === false && X.favAnyCollapsed() === true);
  const map = JSON.parse(W.__storage.get('opn-favcollapse-v576') || '{}');
  check('L2 the collapse map carries every folder id', X.favFolders().every((f) => map[f.id] === 1), map);
  X.favExpandAll();
  check('L2 expand all clears the map whole', X.favFolders().every((f) => !X.favCollapsed(f.id)) && (W.__storage.get('opn-favcollapse-v576') || '') === '{}');
}

{ // L3 per-folder item reorder + L4 folder reorder
  const W = makeWorld(true);
  const X = W.__x;
  X.starredSet([epA, epPod, door, epB]);
  X.enterFavReorder();
  check('L3 the mode stands with the visible folders in standing order', !!X.favReorder && JSON.stringify(X.favReorder.folders) === JSON.stringify(['praylist', 'catechesis', 'podcasts']), X.favReorder && X.favReorder.folders);
  check('L3 the mode carries each folder\u2019s items', JSON.stringify(X.favReorder.items.praylist) === JSON.stringify(['episode:day-ep-1', 'episode:day-ep-2']) && JSON.stringify(X.favReorder.items.podcasts) === JSON.stringify(['series:bible-in-a-year']), X.favReorder.items);
  X.favReorder.items.praylist.reverse();
  X.favReorder.folders = ['podcasts', 'praylist', 'catechesis'];
  X.favReorderDone();
  check('L3 Done splices the dragged order into the folder\u2019s own positions only', JSON.stringify(X.state.starred.map((e) => e.id)) === JSON.stringify(['day-ep-2', 'ep-42', 'bible-in-a-year', 'day-ep-1']), X.state.starred.map((e) => e.id));
  await settle();
  const read = await X.api('/api/prayer/starred');
  check('L3 the new order persists through the standing sync', JSON.stringify((read.starred || []).map((e) => e.id)) === JSON.stringify(['day-ep-2', 'ep-42', 'bible-in-a-year', 'day-ep-1']), (read.starred || []).map((e) => e.id));
  check('L4 Done writes the folder order to the device key', (W.__storage.get('opn-favfolderorder-v579') || '') === JSON.stringify(['podcasts', 'praylist', 'catechesis']), W.__storage.get('opn-favfolderorder-v579'));
  check('L4 favFolders reads the saved folder order back', JSON.stringify(X.favFolders().map((f) => f.id)) === JSON.stringify(['podcasts', 'praylist', 'catechesis', 'prayers', 'novenas']), X.favFolders().map((f) => f.id)); // v581 pin
  check('L4 the mode is cleared after Done', X.favReorder === null);
}

{ // L5 the Prayers folder + L8 the rows
  const W = makeWorld(true);
  const X = W.__x;
  X.state.book = BOOK;
  X.state.bookFavs = ['our-father', 'memorare', 'hail-mary'];
  X.starredSet([epA]);
  X.enterFavReorder();
  check('L5 the mode carries the Prayers folder\u2019s slugs', JSON.stringify((X.favReorder.items.prayers || [])) === JSON.stringify(['prayer:our-father', 'prayer:memorare', 'prayer:hail-mary']), X.favReorder.items);
  X.favReorder.items.prayers.reverse();
  const before = X.bookSyncs;
  X.favReorderDone();
  check('L5 Done rewrites the slug array in dragged order', JSON.stringify(X.bookFavsList()) === JSON.stringify(['hail-mary', 'memorare', 'our-father']), X.bookFavsList());
  check('L5 the rewrite rides the book sync', X.bookSyncs === before + 1, X.bookSyncs);
  const rowHtml = X.favReorderRowHtml(epA);
  check('L8 an item row carries its star key + handle', rowHtml.includes('data-favrow="episode:day-ep-1"') && rowHtml.includes('data-favhandle="episode:day-ep-1"'), rowHtml.slice(0, 160));
  const pHtml = X.favReorderPrayerRowHtml('our-father');
  check('L8 a prayer row carries its prayer key + the prayer\u2019s name', pHtml.includes('data-favrow="prayer:our-father"') && pHtml.includes('Our Father'), pHtml.slice(0, 160));
}

{ // L6 visibility + availability + L7 sweep indifference
  const W = makeWorld(true);
  const X = W.__x;
  X.starredSet([epA, folderDef]);
  check('L6 empty default folders are absent, the empty custom folder stands', JSON.stringify(X.favReorderVisibleFolders().map((f) => f.id)) === JSON.stringify(['praylist', 'fkeep']), X.favReorderVisibleFolders().map((f) => f.id));
  check('L6 two visible folders make the mode available', X.favReorderAvailable() === true);
  const W2 = makeWorld(true);
  const X2 = W2.__x;
  X2.starredSet([epA]);
  check('L6 one folder with one item is not enough', X2.favReorderAvailable() === false);
  X2.enterFavReorder();
  check('L6 entering an unavailable mode stands nothing', X2.favReorder === null);
  X2.starredSet([epA, epB]);
  check('L6 one folder with two items is available', X2.favReorderAvailable() === true);
  // L7: reorder yesterday's entry inside Praylist, then sweep
  const W3 = makeWorld(true);
  const X3 = W3.__x;
  X3.starredSet([epOld, epA]);
  X3.enterFavReorder();
  X3.favReorder.items.praylist.reverse();
  X3.favReorderDone();
  check('L7 the reorder saved (yesterday\u2019s entry now second)', JSON.stringify(X3.state.starred.map((e) => e.id)) === JSON.stringify(['day-ep-1', 'day-ep-old']), X3.state.starred.map((e) => e.id));
  check('L7 the sweep still resets the reordered yesterday entry', X3.favPraylistSweep() === true && !X3.state.starred.some((e) => e.id === 'day-ep-old'));
}

console.log('harness-v579:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
