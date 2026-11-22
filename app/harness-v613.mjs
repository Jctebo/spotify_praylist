// harness-v613.mjs — v613: Favorites reorder mode hides
// empty custom folders — the mode reads the PAGE predicate
// (favFolderCount > 0), one derivation on both surfaces.
//
// Legs (Plan §2):
//   R1 empty custom absent from the reorder list AND the
//      painted reorder sections.
//   R2 a non-empty custom stands — with a track, and
//      (separately) with only a series door.
//   R3 the five defaults stand exactly per their count;
//      the reorder list equals favVisibleFolders()
//      id-for-id.
//   R4 a folder emptied mid-mode leaves on the next paint;
//      Done then saves cleanly (no throw, standing orders
//      written, the hidden folder derives no write).
//   R5 the page rule unregressed: favVisibleFolders()
//      output byte-identical before/after; the page paint
//      for the fixture store unchanged (same store driven
//      through the pinned pre-v613 client).
//   R6 management seats unregressed: Move-to still names
//      the empty custom folder; the page ⋮ seat code
//      (openFavFolderMenu + favFolderSectionHtml) is
//      text-identical to the pre-v613 client.
//   OA1 fail-on-old: R1 driven against the pinned pre-v613
//      client FAILS — the empty custom stands in its
//      reorder list (the divergence reproduces).
//
// Fixtures (Improvement D — production shapes only): the
// starred snapshots carry the fields starEntryForDesc
// builds from live descriptors (the harness-v579 fixture
// shapes); folder definitions are the store's k:'folder'
// entries; the Prayers folder stands on book favorites
// from the production book fixture
// (tests/fixtures-v603/book.json). Worlds are the
// harness-v612 recipe: the FULL rendered client in jsdom
// over the real shell, device mode (navigator.standalone).
// The old-client ref is pinned by commit to the v612 ship
// tree (2be0fb5), never the moving main.
//
// Run: node harness-v613.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
const OLD = '2be0fb5a4469b7add1ad7a5de6e5aaeb39cc8d56'; // the v612 ship tree (pre-v613)
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 500)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', OLD + ':app/worker/src/client.ts']);
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BOOK_SLUG = BOOK.groups[0].prayers[0].slug;

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v613:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, starredSet, bookFavsSet, bookFavsList, favoritesList, favFolders, favFolderCount, favVisibleFolders, favReorderVisibleFolders, favReorderAvailable, favReorderFolderItems, enterFavReorder, favReorderDone, favMoveItems, favFolderOf, paintFavoritesPage, get favReorder() { return favReorder; } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}

// Fixture entries — the starEntryForDesc snapshot fields
// (harness-v579 shapes). Dates stand empty: an entry with
// no date never resets in the Praylist sweep.
const epA = { k: 'episode', id: 'day-ep-1', title: 'Morning Psalm', sub: 'Morning Prayer', durationS: 300, imageUrl: '', block: 'Morning Prayer', url: 'https://x/1.mp3', date: '' };
const epB = { k: 'episode', id: 'day-ep-2', title: 'Morning Reading', sub: 'Morning Prayer', durationS: 240, imageUrl: '', block: 'Morning Prayer', url: 'https://x/2.mp3', date: '' };
const epKeep = { k: 'episode', id: 'ep-keep', title: 'Kept Talk', sub: 'Talk', durationS: 600, imageUrl: '', block: '', url: 'https://x/k.mp3', date: '', folder: 'fkeep' };
const doorPod = { k: 'series', id: 'bible-in-a-year', title: 'Bible in a Year', sub: 'Podcast', durationS: 0, imageUrl: 'https://img/biy.png', block: '', url: null, date: '', folder: 'fdoor' };
const defKeep = { k: 'folder', id: 'fkeep', title: 'Keepers', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' };
const defDoor = { k: 'folder', id: 'fdoor', title: 'Door Shelf', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' };
const defEmpty = { k: 'folder', id: 'fempty', title: 'Empty Shelf', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' };
const STORE = [epA, defKeep, epKeep, defDoor, doorPod, defEmpty];

async function settledWorld(js, store, bookFavs) {
  const w = makeWorld(js);
  await sleep(400);
  const O = w.__opn;
  O.starredSet(JSON.parse(JSON.stringify(store)));
  O.bookFavsSet((bookFavs || []).slice());
  await sleep(120);
  return { w, O };
}
const sectionIds = (w) => Array.prototype.slice.call(w.document.querySelectorAll('[data-favfolder]')).map((r) => r.getAttribute('data-favfolder'));

// ---------- R1 + R2 + R3 (one world) ----------
{
  const { w, O } = await settledWorld(appJs, STORE, [BOOK_SLUG]);
  const vis = O.favVisibleFolders().map((f) => f.id);
  const reo = O.favReorderVisibleFolders().map((f) => f.id);
  check('R3 defaults stand exactly per count; reorder list == page list id-for-id', JSON.stringify(vis) === JSON.stringify(['praylist', 'prayers', 'fkeep', 'fdoor']) && JSON.stringify(reo) === JSON.stringify(vis), { vis, reo });
  check('R1 the empty custom folder is absent from the reorder list', !reo.includes('fempty'), reo);
  O.enterFavReorder();
  await sleep(120);
  const secs = sectionIds(w);
  check('R1 the painted reorder sections stand without the empty custom', JSON.stringify(secs) === JSON.stringify(['praylist', 'prayers', 'fkeep', 'fdoor']), secs);
  const keepItems = w.document.querySelector('[data-favitems="fkeep"]');
  check('R2 the track-holding custom stands with its row', !!keepItems && !!keepItems.querySelector('[data-favrow="episode:ep-keep"]'), keepItems && keepItems.innerHTML.slice(0, 200));
  const doorItems = w.document.querySelector('[data-favitems="fdoor"]');
  check('R2 the door-only custom stands with its row', !!doorItems && !!doorItems.querySelector('[data-favrow="series:bible-in-a-year"]'), doorItems && doorItems.innerHTML.slice(0, 200));
  w.close();
}

// ---------- R4 emptied mid-mode ----------
{
  const { w, O } = await settledWorld(appJs, [epA, epB, defKeep, epKeep], []);
  O.enterFavReorder();
  await sleep(120);
  check('R4 the mode opens with the one-item custom standing', sectionIds(w).includes('fkeep') && !!O.favReorder, sectionIds(w));
  // The sync-repaint shape: the folder's last item leaves
  // the store (its definition stands), then a repaint.
  O.starredSet([JSON.parse(JSON.stringify(epA)), JSON.parse(JSON.stringify(epB)), JSON.parse(JSON.stringify(defKeep))]);
  O.paintFavoritesPage(O.state.dayPayload);
  await sleep(120);
  check('R4 the emptied folder leaves on the next paint', !sectionIds(w).includes('fkeep') && sectionIds(w).includes('praylist'), sectionIds(w));
  let threw = '';
  try { O.favReorderDone(); } catch (e) { threw = e.message; }
  await sleep(120);
  const savedOrder = JSON.parse(w.localStorage.getItem('opn-favfolderorder-v579') || '[]');
  check('R4 Done saves cleanly — no throw, standing orders written, hidden folder skipped', threw === '' && O.favReorder === null && savedOrder.includes('praylist') && !savedOrder.includes('fkeep'), { threw, savedOrder });
  check('R4 the store stands untouched by the hidden folder', JSON.stringify(O.state.starred.map((e) => e.id)) === JSON.stringify(['day-ep-1', 'day-ep-2', 'fkeep']), O.state.starred.map((e) => e.id));
  w.close();
}

// ---------- R5 page rule unregressed (new vs pinned old) ----------
{
  const a = await settledWorld(appJs, STORE, [BOOK_SLUG]);
  const b = await settledWorld(oldJs, STORE, [BOOK_SLUG]);
  const visA = JSON.stringify(a.O.favVisibleFolders());
  const visB = JSON.stringify(b.O.favVisibleFolders());
  check('R5 favVisibleFolders() output byte-identical before/after', visA === visB, { visA, visB });
  a.O.paintFavoritesPage(a.O.state.dayPayload);
  b.O.paintFavoritesPage(b.O.state.dayPayload);
  await sleep(150);
  const htmlA = a.w.document.getElementById('view').innerHTML;
  const htmlB = b.w.document.getElementById('view').innerHTML;
  check('R5 the page paint for the fixture store is unchanged', htmlA === htmlB, { lenA: htmlA.length, lenB: htmlB.length });
  a.w.close(); b.w.close();
}

// ---------- R6 management seats ----------
{
  const { O } = await settledWorld(appJs, STORE, [BOOK_SLUG]);
  const labels = O.favMoveItems(O.state.starred.find((e) => e.id === 'day-ep-1')).map((i) => i.label);
  check('R6 Move-to still names the empty custom folder', labels.includes('Move to Empty Shelf'), labels);
  const fnText = (js, name) => { const a = js.indexOf('function ' + name); const b = js.indexOf('\nfunction ', a + 1); return a < 0 ? '' : js.slice(a, b < 0 ? js.length : b); };
  check('R6 the page menu seat code is text-identical to pre-v613', fnText(appJs, 'openFavFolderMenu') !== '' && fnText(appJs, 'openFavFolderMenu') === fnText(oldJs, 'openFavFolderMenu') && fnText(appJs, 'favFolderSectionHtml') === fnText(oldJs, 'favFolderSectionHtml'));
}

// ---------- OA1 fail-on-old ----------
{
  const { O } = await settledWorld(oldJs, STORE, [BOOK_SLUG]);
  const reo = O.favReorderVisibleFolders().map((f) => f.id);
  check('OA1 fail-on-old: the empty custom STANDS in the pre-v613 reorder list (R1 fails there)', reo.includes('fempty'), reo);
}

console.log('harness-v613:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
