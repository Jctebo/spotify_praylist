// harness-v639.mjs — v639: in the track row's ⋮ menu,
//  'Mark as read' replaces 'Open in Spotify' (John,
//  2026-11-23: "Can you replace open in Spotify with Mark
//  as read?"). One item builder (dayRowMarkItem639) is
//  consumed by openDayRowMenu and by openFavRowMenu's
//  mirror menu; the act writes through the standing
//  per-family discipline (the epCardTogglePlayed
//  precedent): day tracks → the played store under the
//  played dot's own key (v610 occurrence-aware); podcast
//  episodes standing in the day → the core listen store;
//  recorded homilies → the homily store's played flag.
//  No mark, no act: unavailable tracks and descriptors
//  with no episode identity carry neither act.
//
// Legs:
//  L1 ◆ the row menu on each mark-carrying row kind
//     (day track · podcast episode · recorded homily ·
//     an already-marked day track) carries the mark item
//     at the retired Spotify position (after Download,
//     before caller extraItems) and NOT 'Open in
//     Spotify'; the Favorites mirror menu carries it too
//     and its act writes the played store.
//  L2 ◆ Mark as read on an unplayed podcast episode
//     standing in the day writes its core listen mark —
//     the descriptor's listened flag flips, the row's
//     poddot dresses played, and the block head's
//     unplayed count drops by one in place (same node).
//  L3 ◆ Mark as read on a day track writes its played
//     mark — and on a v610 occurrence copy, only that
//     copy's mark (the other copy stands unplayed).
//  L4 ◆ Mark as unread clears the mark and the count
//     rises back (day track and podcast legs).
//  L5 ◆ a family with no mark (an unavailable track, a
//     descriptor with no episode identity) carries no
//     such act — and no 'Open in Spotify' either.
//  ◆ legs fail on the base client (366007b, the v637
//  ship tree): run this harness in a detached worktree
//  of that tree and every ◆ leg fails there (recorded
//  in docs/releases/v639.md §3).
//
// Fixtures (Improvement D — production sources, named):
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — John's own exported
//    document, seeded as the personal-data store (the
//    harness-v615 recipe; podcastListens deleted so the
//    core starts from the document's other sections).
//  - tests/fixtures-v597/production-day-2026-11-21.json
//    + production-source-settings.json — the production
//    day payload and his production source settings,
//    building the standing world (the harness-v615
//    buildStanding / paintRealDay recipe).
//  - tests/fixtures-v620/frmike-payload-live.json — the
//    LIVE served payload for series fr-mike-homilies
//    (fetched from app.orapronobis.media 2026-11-22);
//    entries[0] IS the podcast descriptor's identity
//    (episodeId = seriesKey = its key, podSeries =
//    'fr-mike-homilies', url = its Fireside enclosure).
//  - tests/fixtures-v603/book.json · novenas.json ·
//    podcasts-index.json — the fetch-stub bodies (the
//    harness-v615 recipe).
//  - The homily seed follows the v551 homily index
//    store shape ('opn-homilies-v551': entries carrying
//    id + played), the store homilySetPlayed writes.
//  - Synthetic day descriptors follow harness-v615's
//    synthTrack shape over that production world.
//
// Run: node app/harness-v639.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- T statics ----------
check('T1 the ONE builder stands and both menus consume it; neither menu builder carries an \'Open in Spotify\' push',
  clientSrc.includes('function dayRowMarkItem639(')
  && grab(clientSrc, 'openDayRowMenu').includes('dayRowMarkItem639(t)')
  && grab(clientSrc, 'openFavRowMenu').includes('dayRowMarkItem639(desc)')
  && !grab(clientSrc, 'openDayRowMenu').includes('Open in Spotify')
  && !grab(clientSrc, 'openFavRowMenu').includes('Open in Spotify'));
check('T2 the block page\'s page-menu \'Open in Spotify\' stands untouched (the one remaining push, keyed on the block\'s own spotifyUrl)',
  (clientSrc.match(/label: 'Open in Spotify'/g) || []).length === 1
  && clientSrc.includes("if (b.spotifyUrl) items.push({ label: 'Open in Spotify'"));
check('T3 the mark write follows the per-family discipline inside the builder\'s act (played dot key · epCard podcast discipline · homily store)',
  grab(clientSrc, 'dayRowMarkApply639').includes("writePlayed(t.episodeId, presentedDateStr(), on ? 'marked' : null, t.block || t._block || '', t._occ || 0)")
  && grab(clientSrc, 'dayRowMarkApply639').includes('podToggleMark(t.seriesKey)')
  && grab(clientSrc, 'dayRowMarkApply639').includes("writePodMarkQuiet(t.seriesKey, t.podSeries, 'manual')")
  && grab(clientSrc, 'dayRowMarkApply639').includes("post('/api/player/podcasts/unmark'")
  && grab(clientSrc, 'dayRowMarkApply639').includes('podSyncQueueListened(t.podSeries, t.seriesKey, false)')
  && grab(clientSrc, 'dayRowMarkApply639').includes('homilySetPlayed(t.homilyId, on)'));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v639:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const FRMIKE = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/frmike-payload-live.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const PLAYED_KEY = 'opn-played-v344';
const FM = FRMIKE.entries[0];
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, openDayRowMenu, openFavRowMenu, isPlayedDesc, writePlayed, refreshPlayedChrome, opnPodCore, homilyEntry, playedDotHtml, heardCls, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, dayRowMarkItem639: (typeof dayRowMarkItem639 !== "undefined" ? dayRowMarkItem639 : null) };';
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
function makeWorld(store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  // The cache read in openDayRowMenu's build: nothing
  // standing cached, so the Download item stands and the
  // mark item's position after it is observable.
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(null) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({
    [DATA_KEY]: JSON.stringify(JOHN),
    'opn-praylistmode-v604': 'expanded',
    'opn-homilies-v551': JSON.stringify([{ id: 'v639-hom-1', title: 'Recorded homily', played: false }]),
  }, extra || {});
}
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0(DATE);
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
async function paintSynthetic(w, descs) {
  const O = w.__opn;
  await paintRealDay(w);
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  O.paintPrayersView(O.state.dayPayload);
  await sleep(120);
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}
function podDesc639() {
  // The v620 composed-descriptor shape over the LIVE
  // Fr. Mike payload entry (fixtures named in the head).
  return synthTrack({ episodeId: FM.key, kind: 'podcast', podSeries: 'fr-mike-homilies', seriesKey: FM.key, listened: false, title: FM.title, url: FM.url, streamUrl: FM.url });
}
const countOf = (d, block) => { const el = d.querySelector('[data-p615count="' + block + '"]'); return el ? el.textContent : null; };
function menuLabels(w) { return [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].map((b) => b.textContent.trim()); }
function menuClick(w, label) {
  const b = [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === label);
  if (!b) return false;
  b.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}
async function openDayMenu(w, t, extra) {
  const O = w.__opn;
  const anchor = w.document.createElement('button');
  w.document.body.appendChild(anchor);
  O.openDayRowMenu(t, anchor, extra || null);
  await sleep(150);
  return menuLabels(w);
}
const DETAILS = [{ label: 'Details', act: function () {} }];

// ---------- L1 ◆ menu contents per row kind + the Favorites mirror ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  const dayT = synthTrack({ episodeId: 'v639-day-1', title: 'Day track', spotifyUrl: 'https://open.spotify.com/track/v639' });
  const podT = podDesc639();
  const homT = synthTrack({ episodeId: 'homily:v639-hom-1', kind: 'homily', homilyId: 'v639-hom-1', title: 'Recorded homily' });
  const markedT = synthTrack({ episodeId: 'v639-day-2', title: 'Marked track', spotifyUrl: 'https://open.spotify.com/track/v639b' });
  await paintSynthetic(w, [dayT, podT, homT, markedT]);
  O.writePlayed('v639-day-2', DATE, 'marked', 'Morning', 0);
  const cases = [
    ['day track', dayT, 'Mark as read'],
    ['podcast episode', podT, 'Mark as read'],
    ['recorded homily', homT, 'Mark as read'],
    ['already-marked day track', markedT, 'Mark as unread'],
  ];
  for (const [kindName, t, want] of cases) {
    const labels = await openDayMenu(w, t, DETAILS);
    const mi = labels.indexOf(want);
    check(`L1 ◆ ${kindName}: the menu carries '${want}' at the retired Spotify position (after Download, before the caller's Details) and NOT 'Open in Spotify'`,
      mi > -1 && !labels.includes('Open in Spotify')
      && labels.indexOf('Download') > -1 && mi === labels.indexOf('Download') + 1
      && labels.indexOf('Details') === mi + 1,
      { labels });
  }
  // The Favorites mirror menu (only the snapshot stands:
  // the id stands in no live descriptor).
  const entry = { k: 'episode', id: 'v639-fav-snap', title: 'Snapshot track', sub: 'Morning', block: 'Morning', url: 'https://example.invalid/f.mp3', durationS: 30, date: DATE, imageUrl: '' };
  const anchor = w.document.createElement('button');
  w.document.body.appendChild(anchor);
  O.openFavRowMenu(entry, anchor);
  await sleep(100);
  const flabels = menuLabels(w);
  check('L1 ◆ Favorites mirror menu: carries \'Mark as read\' and NOT \'Open in Spotify\'',
    flabels.includes('Mark as read') && !flabels.includes('Open in Spotify'), { flabels });
  const clicked = menuClick(w, 'Mark as read');
  await sleep(80);
  check('L1 ◆ Favorites mirror act: the mark writes the played store for the snapshot descriptor (its own played dot\'s store)',
    clicked && O.isPlayedDesc({ episodeId: 'v639-fav-snap', block: 'Morning' }, DATE),
    { clicked });
  w.close();
}

// ---------- L2 ◆ podcast mark: core listen + dress + head count in place ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const pod = podDesc639();
  const plain = synthTrack({ episodeId: 'v639-plain-1', title: 'Plain track' });
  await paintSynthetic(w, [pod, plain]);
  const countElBefore = d.querySelector('[data-p615count="Morning"]');
  const before = countElBefore ? countElBefore.textContent : null;
  const labels = await openDayMenu(w, pod);
  check('L2 ◆ podcast menu stands with \'Mark as read\' and the head count reads 2 before the act',
    labels.includes('Mark as read') && before === '2', { labels, before });
  const dotBefore = O.playedDotHtml(pod);
  const clicked = menuClick(w, 'Mark as read');
  await sleep(150);
  const core = O.opnPodCore();
  const countElAfter = d.querySelector('[data-p615count="Morning"]');
  // The row dress reads through the standing paint seams
  // the row itself paints from (playedDotHtml's poddot +
  // heardCls's title class — the folded home paint carries
  // heads only, so the dress is read at its generating
  // seam, exactly the HTML the expanded row stands with).
  const dotAfter = O.playedDotHtml(pod);
  check('L2 ◆ Mark as read on the podcast episode: its CORE listen mark stands (series|key), the descriptor\'s listened flag flips, the row dress turns played (poddot \'on\' + heard title at the paint seam), and the head count drops by one in place (same DOM node)',
    clicked && !!core.listens['fr-mike-homilies|' + FM.key]
    && pod.listened === true
    && !/poddot on/.test(dotBefore) && /poddot on/.test(dotAfter) && /heard/.test(O.heardCls(pod))
    && !!countElAfter && countElAfter === countElBefore && countElAfter.textContent === '1',
    { clicked, core: !!core.listens['fr-mike-homilies|' + FM.key], listened: pod.listened, dotBefore, dotAfter, before, after: countElAfter && countElAfter.textContent, sameNode: countElAfter === countElBefore });
  // L4 (podcast leg) rides this world: unmark clears the
  // core listen and the count rises back.
  const labels2 = await openDayMenu(w, pod);
  const clicked2 = labels2.includes('Mark as unread') && menuClick(w, 'Mark as unread');
  await sleep(200);
  const core2 = O.opnPodCore();
  check('L4 ◆ podcast Mark as unread: the label reads from the marked state, the act clears the CORE listen, the flag flips back, and the head count rises back to 2',
    !!clicked2 && !core2.listens['fr-mike-homilies|' + FM.key] && pod.listened === false && countOf(d, 'Morning') === '2',
    { labels2, clicked2, listened: pod.listened, count: countOf(d, 'Morning') });
  w.close();
}

// ---------- L3 ◆ day-track mark + v610 occurrence-copy isolation ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const copy0 = synthTrack({ episodeId: 'ext-morning-prayer', title: 'Morning Prayer' });
  const copy1 = synthTrack({ episodeId: 'ext-morning-prayer', title: 'Morning Prayer', _occ: 1 });
  O.state.repeatIds = { 'ext-morning-prayer': true }; // the fold's own stamp (the harness-v615 H6 recipe)
  await paintSynthetic(w, [copy0, copy1]);
  O.state.repeatIds = { 'ext-morning-prayer': true };
  const labels = await openDayMenu(w, copy1);
  const clicked = labels.includes('Mark as read') && menuClick(w, 'Mark as read');
  await sleep(100);
  const map = JSON.parse(w.localStorage.getItem(PLAYED_KEY) || '{}');
  check('L3 ◆ Mark as read on the v610 occurrence copy (_occ 1): only that copy\'s mark stands — its occurrence key carries the date, copy 0 stands unplayed, the head count drops by exactly one',
    !!clicked && O.isPlayedDesc(copy1, DATE) === true && O.isPlayedDesc(copy0, DATE) === false
    && Object.keys(map).some((k) => k.endsWith('#1') && map[k][DATE])
    && countOf(d, 'Morning') === '1',
    { clicked, c1: O.isPlayedDesc(copy1, DATE), c0: O.isPlayedDesc(copy0, DATE), keys: Object.keys(map), count: countOf(d, 'Morning') });
  // L4 (day leg) rides this world.
  const labels2 = await openDayMenu(w, copy1);
  const clicked2 = labels2.includes('Mark as unread') && menuClick(w, 'Mark as unread');
  await sleep(100);
  check('L4 ◆ day-track Mark as unread: the mark clears (that copy unplayed again) and the head count rises back to 2',
    !!clicked2 && O.isPlayedDesc(copy1, DATE) === false && countOf(d, 'Morning') === '2',
    { labels2, clicked2, count: countOf(d, 'Morning') });
  w.close();
}

// ---------- L5 ◆ no mark, no act ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  const unavail = synthTrack({ episodeId: 'v639-unavail', title: 'Unavailable track', available: false, spotifyUrl: 'https://open.spotify.com/track/v639u' });
  const noId = synthTrack({ episodeId: '', title: 'No identity' });
  await paintSynthetic(w, [unavail, noId]);
  const l1 = await openDayMenu(w, unavail);
  check('L5 ◆ an unavailable track (a Spotify URL standing) carries NEITHER \'Mark as read\'/\u2018Mark as unread\u2019 NOR \'Open in Spotify\'',
    !l1.includes('Mark as read') && !l1.includes('Mark as unread') && !l1.includes('Open in Spotify'), { l1 });
  const l2 = await openDayMenu(w, noId);
  check('L5 ◆ a descriptor with no episode identity carries NEITHER act either',
    !l2.includes('Mark as read') && !l2.includes('Mark as unread') && !l2.includes('Open in Spotify'), { l2 });
  check('L5 ◆ the builder itself returns null for both no-mark shapes',
    !!O.dayRowMarkItem639 && O.dayRowMarkItem639(unavail) === null && O.dayRowMarkItem639(noId) === null);
  w.close();
}

console.log('\nharness-v639:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
