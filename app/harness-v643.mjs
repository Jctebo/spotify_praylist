// harness-v643.mjs — v643: a page for each track.
//  The share link's identity (the v640 query form, byte-
//  for-byte, plus the &src= office amendment) now resolves
//  to the track's OWN page — one app page (Shape 1, bound
//  2026-11-24): image · title · standing line · one large
//  Play · the track's text — instead of landing inside the
//  Praylist/series/book lists. Homilies get NO page (John's
//  carve-out): a homily share sends the audio file itself
//  as an attachment (APK bridge shareFileBegin/Chunk/End,
//  chunked at HOMILY_NATIVE_CHUNK per the readNativeTakeChunk
//  precedent; navigator.share({files}) where canShare
//  stands), and the copy sheet with the named line stands
//  where no file route stands. Note-only homilies share
//  their note text.
//
// Gates:
//  G1 ◆ Ora episode: ?s=day lands on its page (title ·
//     image · line), Play sounds that episode through
//     playTrack, its text stands (descText + read-along).
//     No list landing, no autoplay. G1b: a ?s=pod landing
//     paints the episode's page the same way.
//  G2 ◆ Office: &src= selects that source's whole record
//     (original title · image · its own stream) — via the
//     slot's backup side on the pre-v650 shape, and via
//     src alone on a v650-shaped two-track fixture.
//  G3 ◆ Prayer: ?s=prayer lands on the page with the book
//     body as its text; Play sounds the prayer's audio for
//     the identity's language (the page opens on the
//     identity's language — the Implement-named choice).
//  G4 ◆ Stale/unknown/malformed/invalid-src and BOTH
//     homily identity forms land on the plain app — no
//     page, no error, query stripped.
//  G5 ◆ Homily attachment: APK world (bridge stubbed) —
//     begin/chunk/end called with the take's exact bytes,
//     never a link; file-capable web world — navigator.
//     share receives the File; no-file-route world — the
//     sheet stands with Copy link + the named line, no
//     dead Share… row. In-day homilies take the file route
//     too. Note-only entries share note text, no file.
//  G6 ◆ Public surface: the page world runs signed-out on
//     the public host shape; the painted page's HTML and
//     every request carry no personal data (no intention
//     text, no draw, no Conscience, no additions, no
//     played/position state, no vault field); the page's
//     own code never calls trackDrawTextFor/ensureTrackDraw.
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the production day
//    payload + source settings (the harness-v640/v644
//    buildStanding / paintRealDay recipe).
//  - tests/fixtures-v603/book.json — the production book
//    payload shape (Our Father: body + bodyLatin + audio
//    {en, la}).
//  - tests/fixtures-v620/frmike-payload-live.json — the
//    LIVE Fr. Mike series payload (the pod fixture).
//  - The v551 store shapes: the localStorage index
//    'opn-homilies-v551' entry shape (v640's seed) + the
//    IndexedDB 'opn-homilies' chunks shape ({id, seq,
//    blob}), served here by a minimal IDB stub (jsdom
//    carries no IndexedDB; the stub speaks exactly the
//    surface homilyDb/homilyChunks call).
//  - john-personal-data-import-v589.json — John's own
//    exported document as the personal-data store for the
//    signed-in worlds (podcastListens deleted, the v640
//    recipe); the G6 world runs WITHOUT it (signed-out).
//
// Run: node app/harness-v643.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- T statics ----------
check('T1 builder: shareAppUrlFor adds &src=<source> only for kind external, from the descriptor source',
  (() => { const b = grab(clientSrc, 'shareAppUrlFor'); return !!b && b.includes("t.kind === 'external'") && b.includes("'&src=' + shareEnc640(t.source)"); })());
check('T2 sender split: shareTrackSheet routes homily descriptors to homilyShareSheet643 before openShareSheet is reached',
  (() => { const b = grab(clientSrc, 'shareTrackSheet'); return !!b && b.includes('homilyShareSheet643(t)') && b.indexOf('homilyShareSheet643(t)') < b.indexOf('openShareSheet('); })());
check('T3 page discipline: openTrackPage643 / trackPagePaintDay643 / trackPageDaySelect643 never call trackDrawTextFor or ensureTrackDraw',
  ['openTrackPage643', 'trackPagePaintDay643', 'trackPageDaySelect643'].every((n) => { const b = grab(clientSrc, n); return !!b && !b.includes('trackDrawTextFor') && !b.includes('ensureTrackDraw'); }));
check('T4 homily landing retired: shareLandingConsume carries no Homilies-list landing (no switchPodSide) and the homily form still parses at the read',
  !grab(clientSrc, 'shareLandingConsume').includes('switchPodSide') && grab(clientSrc, 'shareLandingRead').includes("s === 'homily'"));
check('T5 native file route: nativeShareFile643 rides shareFileBegin/shareFileChunk/shareFileEnd in HOMILY_NATIVE_CHUNK pieces',
  (() => { const b = grab(clientSrc, 'nativeShareFile643'); return !!b && b.includes('shareFileBegin') && b.includes('shareFileChunk') && b.includes('shareFileEnd') && b.includes('HOMILY_NATIVE_CHUNK') && b.includes('homilyTakeBlob'); })());

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
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v643:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
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
const FM = FRMIKE.entries[0];
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, shareAppUrlFor: (typeof shareAppUrlFor !== "undefined" ? shareAppUrlFor : null), shareTrackSheet: (typeof shareTrackSheet !== "undefined" ? shareTrackSheet : null), shareLandingConsume: (typeof shareLandingConsume !== "undefined" ? shareLandingConsume : null), shareLandingGet: function () { return (typeof shareLanding !== "undefined" ? shareLanding : undefined); }, shareLandingSet: function (v) { try { shareLanding = v; } catch (e) {} }, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REQUESTS = [];
function fetchStub(url) {
  const u = String(url);
  REQUESTS.push(u);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=fr-mike-homilies')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/frmike-payload-live.json', 'utf8'));
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  else if (u.includes('/api/player/text/')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('READ-ALONG LINE ONE\nREAD-ALONG LINE TWO') });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function stubHomilyIdb(w, chunksById) {
  const stores = { takes: new Map(), chunks: new Map() };
  Object.entries(chunksById || {}).forEach(([id, parts]) => parts.forEach((blob, seq) => stores.chunks.set(id + '|' + seq, { id, seq, blob })));
  const db = {
    objectStoreNames: { contains: (n) => n in stores },
    createObjectStore: (n) => { if (!(n in stores)) stores[n] = new Map(); return {}; },
    transaction: (store) => ({
      objectStore: () => ({
        getAll: (range) => {
          const req = {};
          req.result = [...stores[store].values()].filter((r) => !range || r.id === range.__id);
          queueMicrotask(() => { if (req.onsuccess) req.onsuccess(); });
          return req;
        },
        put: () => {}, delete: () => {},
      }),
      oncomplete: null, onerror: null,
    }),
  };
  w.indexedDB = {
    open: () => {
      const req = { result: db };
      queueMicrotask(() => { if (req.onupgradeneeded) req.onupgradeneeded(); if (req.onsuccess) req.onsuccess(); });
      return req;
    },
  };
  w.IDBKeyRange = { bound: (lo) => ({ __id: lo[0] }) };
}
function makeWorld(store, url, idbChunks) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: url || 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(null) }) }; } catch (e) {}
  try { w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.pause = function () {}; } catch (e) {}
  // jsdom's URL.createObjectURL is a not-implemented stub:
  // without a working one the homily mint never caches and
  // the settle/rebuild cycle spins — stub the surface.
  try { w.URL.createObjectURL = function () { return 'blob:harness-643'; }; w.URL.revokeObjectURL = function () {}; } catch (e) {}
  stubHomilyIdb(w, idbChunks);
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded' }, extra || {});
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
function standDescs(w, descs, ms) {
  // Harness stabilization: in the stub world the externals
  // resolver's retry waves keep rebuilding state.dayDescs
  // from the fold during the landing window (in production
  // the fold set IS the track set and builds once). Restand
  // the synthetic set through the window so the landing
  // poll sees it, exactly as a settled production fold
  // would present it.
  const O = w.__opn;
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  const iv = setInterval(() => { O.state.dayDescs = descs; O.state.presentedDay = DATE; }, 50);
  setTimeout(() => clearInterval(iv), ms || 1600);
}
async function waitSettled(w) {
  // The client's own boot day build lands late in jsdom
  // and rebuilds state.dayDescs from the fold; wait until
  // the fold set stands stable across two reads before
  // standing a synthetic set (else the build rebuilds
  // over it mid-landing).
  const O = w.__opn;
  let last = -1, stable = 0;
  for (let i = 0; i < 25 && stable < 2; i++) {
    await sleep(400);
    const n = (O.state.dayDescs || []).length;
    if (n > 0 && n === last) stable++; else stable = 0;
    last = n;
  }
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', url: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function stubClipboard(w, copied) {
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (s) => { copied.push(s); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
}

// ---------- G1 ◆ Ora episode page + G1b pod page ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const own = synthTrack({ episodeId: 'v643-own-1', title: 'Ora Episode One', descText: 'Episode description stands here.', hasText: true, textUrl: '/api/player/text/' + DATE + '/v643-own-1', streamUrl: 'https://example.invalid/own1.mp3', url: 'https://example.invalid/own1.mp3', durationS: 60, imageUrl: 'https://example.invalid/own1.png' });
  await paintSynthetic(w, [own]);
  await waitSettled(w); // the boot build settles; re-stand the synthetic set it rebuilt over
  standDescs(w, [own], 2000);
  O.shareLandingSet({ s: 'day', date: DATE, id: 'v643-own-1' });
  O.shareLandingConsume();
  await sleep(900);
  const page = d.querySelector('#track-page-643');
  check('G1 ◆ a ?s=day link lands on the track\'s OWN page (not the list): the page stands with its title, image, and standing line',
    !!page && page.textContent.includes('Ora Episode One') && !!page.querySelector('img') && page.querySelector('img').getAttribute('src') === 'https://example.invalid/own1.png'
    && O.state.prayersView && O.state.prayersView.kind === 'trackpage643',
    { view: O.state.prayersView && O.state.prayersView.kind, html: page && page.innerHTML.slice(0, 200) });
  check('G1 ◆ nothing autoplays: state.current stands null before the tap',
    O.state.current === null, {});
  check('G1 ◆ the page\'s text stands: the episode description AND the read-along text fetched from its textUrl',
    !!page && page.textContent.includes('Episode description stands here.') && page.textContent.includes('READ-ALONG LINE ONE'),
    { text: page && page.textContent.slice(0, 300) });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G1 ◆ the large Play sounds THAT episode through the funnel: the started descriptor is the episode, with its own stream',
    !!O.state.current && O.state.current.episodeId === 'v643-own-1' && (O.state.current.url === 'https://example.invalid/own1.mp3' || O.state.current.streamUrl === 'https://example.invalid/own1.mp3'),
    { cur: O.state.current && O.state.current.episodeId });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'pod', series: 'fr-mike-homilies', id: FM.key });
  O.shareLandingConsume();
  await sleep(1200);
  const page = d.querySelector('#track-page-643');
  check('G1b ◆ a ?s=pod link lands on the episode\'s own page with its title, and nothing autoplays',
    !!page && page.textContent.includes(FM.title) && O.state.current === null,
    { html: page && page.innerHTML.slice(0, 200), cur: O.state.current });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G1b ◆ the page\'s Play starts that episode through the card\'s standing onPlay path (playPodFrom → the queue\'s head is the episode)',
    !!O.state.current && O.state.current.episodeId === FM.key,
    { cur: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- G2 ◆ office src selection ----------
function officeDesc(source, over) {
  return synthTrack(Object.assign({
    episodeId: 'ext-morning-prayer', kind: 'external', source,
    title: source === 'Sing the Hours' ? 'Morning Prayer — Sing the Hours' : 'Morning Prayer — Divine Office',
    streamUrl: source === 'Sing the Hours' ? 'https://example.invalid/sth.mp3' : 'https://example.invalid/do.mp3',
    url: source === 'Sing the Hours' ? 'https://example.invalid/sth.mp3' : 'https://example.invalid/do.mp3',
    imageUrl: source === 'Sing the Hours' ? 'https://example.invalid/sth.png' : 'https://example.invalid/do.png',
    durationS: 100, _block: 'Morning',
  }, over || {}));
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintSynthetic(w, [officeDesc('Divine Office')]);
  await waitSettled(w);
  O.state.dayDescs = [officeDesc('Divine Office')];
  O.state.presentedDay = DATE;
  // The pre-v650 slot shape: ONE standing record + its backup side.
  O.state.extSlots['ext-morning-prayer'] = { state: 'present', title: 'Morning Prayer — Divine Office', source: 'Divine Office', streamUrl: 'https://example.invalid/do.mp3', durationSec: 100, imageUrl: 'https://example.invalid/do.png', descText: null,
    backup: { title: 'Morning Prayer — Sing the Hours', streamUrl: 'https://example.invalid/sth.mp3', source: 'Sing the Hours', imageUrl: 'https://example.invalid/sth.png', durationSec: 90 } };
  check('G2 ◆ the builder names the source: shareAppUrlFor(a Sing the Hours descriptor) carries &src=Sing%20the%20Hours on the day form',
    O.shareAppUrlFor(officeDesc('Sing the Hours')) === 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=ext-morning-prayer&src=Sing%20the%20Hours',
    { url: O.shareAppUrlFor(officeDesc('Sing the Hours')) });
  O.shareLandingSet({ s: 'day', date: DATE, id: 'ext-morning-prayer', src: 'Sing the Hours' });
  O.shareLandingConsume();
  await sleep(900);
  const page = d.querySelector('#track-page-643');
  check('G2 ◆ src=Sing the Hours lands on THAT source\'s page: its original title and its image, never a swapped label',
    !!page && page.textContent.includes('Morning Prayer — Sing the Hours') && page.querySelector('img').getAttribute('src') === 'https://example.invalid/sth.png',
    { html: page && page.innerHTML.slice(0, 250) });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G2 ◆ its Play sounds the Sing the Hours stream, never the Divine Office stream',
    !!O.state.current && (O.state.current.streamUrl === 'https://example.invalid/sth.mp3' || O.state.current.url === 'https://example.invalid/sth.mp3'),
    { cur: O.state.current && (O.state.current.streamUrl || O.state.current.url) });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  // The v650-shaped fixture: TWO descriptors share the slotId.
  await paintSynthetic(w, [officeDesc('Divine Office'), officeDesc('Sing the Hours')]);
  await waitSettled(w);
  standDescs(w, [officeDesc('Divine Office'), officeDesc('Sing the Hours')], 2000);
  // The fold also carries a desc under this slotId, and a
  // resolver-wave rebuild can land the landing on it in
  // the same window; re-drive until the settled page is
  // the src-selected track's page (the production receiver
  // builds once, from the settled fold).
  let page = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    O.shareLandingSet({ s: 'day', date: DATE, id: 'ext-morning-prayer', src: 'Divine Office' });
    O.shareLandingConsume();
    await sleep(800);
    page = d.querySelector('#track-page-643');
    if (page && page.getAttribute('data-trackpage-key') === 'ext-morning-prayer|Divine Office|https://example.invalid/do.mp3') break;
    if (page) page.remove();
    O.state.prayersView = { kind: 'home' };
    page = null;
  }
  check('G2 ◆ two-track (v650) shape: src=Divine Office alone selects the Divine Office track among the two sharing the slotId',
    !!page && page.textContent.includes('Morning Prayer — Divine Office') && !page.textContent.includes('Morning Prayer — Sing the Hours'),
    { html: page && page.innerHTML.slice(0, 250) });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G2 ◆ and its Play sounds the Divine Office stream',
    !!O.state.current && (O.state.current.streamUrl === 'https://example.invalid/do.mp3' || O.state.current.url === 'https://example.invalid/do.mp3'),
    { cur: O.state.current && (O.state.current.streamUrl || O.state.current.url) });
  w.close();
}

// ---------- G3 ◆ prayer page ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'prayer', id: 'prayer:our-father:en', slug: 'our-father', lang: 'en' });
  O.shareLandingConsume();
  await sleep(1500);
  const page = d.querySelector('#track-page-643');
  check('G3 ◆ a ?s=prayer link lands on the prayer\'s page with the book body as its text block',
    !!page && page.textContent.includes('Our Father') && page.textContent.includes('hallowed be Thy name'),
    { html: page && page.innerHTML.slice(0, 250) });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G3 ◆ its Play sounds the prayer\'s own audio for the identity\'s language (prayer:our-father:en)',
    !!O.state.current && O.state.current.episodeId === 'prayer:our-father:en',
    { cur: O.state.current && O.state.current.episodeId });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'prayer', id: 'prayer:our-father:la', slug: 'our-father', lang: 'la' });
  O.shareLandingConsume();
  await sleep(1500);
  const page = d.querySelector('#track-page-643');
  check('G3 ◆ the Latin identity opens the page on the identity\'s own language: the Latin body stands (the Implement-named choice)',
    !!page && page.textContent.includes('Pater noster'),
    { html: page && page.innerHTML.slice(0, 250) });
  click(w, d.querySelector('#track-play-643'));
  await sleep(250);
  check('G3 ◆ and its Play sounds the Latin audio (prayer:our-father:la)',
    !!O.state.current && O.state.current.episodeId === 'prayer:our-father:la',
    { cur: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- G4 ◆ stale / unknown / homily forms → plain app ----------
{
  const w = makeWorld(johnStore(), 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=ext-morning-prayer&src=Bogus%20Source');
  await sleep(400);
  check('G4 ◆ a present-but-invalid src refuses the whole landing at the read, and the query is stripped',
    w.__opn.shareLandingGet() == null && w.location.search === '',
    { landing: w.__opn.shareLandingGet(), search: w.location.search });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintSynthetic(w, [synthTrack({ episodeId: 'v643-known-1', title: 'Known' })]);
  O.shareLandingSet({ s: 'day', date: DATE, id: 'no-such-track-643' });
  O.shareLandingConsume();
  await sleep(4200);
  check('G4 ◆ an unknown day identity is discarded at the bound: no page, the plain app stands, nothing plays',
    O.shareLandingGet() === null && !d.querySelector('#track-page-643') && O.state.current === null,
    { landing: O.shareLandingGet() });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'homily', id: 'v643-hom-1' });
  O.shareLandingConsume();
  await sleep(400);
  check('G4 ◆ the ?s=homily identity discards to the plain app: no homily page exists, no list landing, nothing plays',
    O.shareLandingGet() === null && !d.querySelector('#track-page-643') && O.state.current === null,
    {});
  O.shareLandingSet({ s: 'day', date: DATE, id: 'homily:v643-hom-1' });
  O.shareLandingConsume();
  await sleep(4200);
  check('G4 ◆ a ?s=day&id=homily:… link likewise lands on the plain app at the bound (the store is device-local)',
    O.shareLandingGet() === null && !d.querySelector('#track-page-643') && O.state.current === null,
    {});
  w.close();
}

// ---------- G5 ◆ homily attachment share ----------
const TAKE = new Uint8Array(300000);
for (let i = 0; i < TAKE.length; i++) TAKE[i] = (i * 7 + 13) % 251;
const HOM_ENTRY = { id: 'v643-hom-1', name: 'Sunday Homily', state: 'ready', played: false, starred: false, dateKey: '2026-11-15', dayName: 'Sunday', durationS: 300, sizeBytes: TAKE.length, mimeType: 'audio/webm', chunkCount: 2, partial: false, createdAt: '2026-11-15T12:00:00.000Z' };
function homilyChunksFor(w) {
  const half = Math.floor(TAKE.length / 2);
  return { 'v643-hom-1': [new w.Blob([TAKE.subarray(0, half)], { type: 'audio/webm' }), new w.Blob([TAKE.subarray(half)], { type: 'audio/webm' })] };
}
function homilyDesc() {
  return synthTrack({ episodeId: 'homily:v643-hom-1', kind: 'homily', homilyId: 'v643-hom-1', title: 'Sunday Homily', url: 'blob:v643-hom-1', streamUrl: null, durationS: 300 });
}
function stubBridge643(w, rec, mode) {
  const plugin = {
    setDaySnapshot: () => Promise.resolve({}), setNativeQueue: () => Promise.resolve({}),
    vaultBiometricStatus: () => Promise.resolve({}), oneEngine: () => Promise.resolve({}),
    shareTrack: (p) => { rec.track.push(p); return Promise.resolve({}); },
  };
  if (mode === 'file') {
    plugin.shareFileBegin = (p) => { rec.begin.push(p); return Promise.resolve({}); };
    plugin.shareFileChunk = (p) => { rec.chunks.push(p.dataBase64); return Promise.resolve({}); };
    plugin.shareFileEnd = (p) => { rec.end.push(p); return Promise.resolve({}); };
  }
  try { Object.defineProperty(w, 'Capacitor', { value: { Plugins: { OraDayBridge: plugin } }, configurable: true }); } catch (e) { w.Capacitor = { Plugins: { OraDayBridge: plugin } }; }
  return plugin;
}
{
  // APK world, chunks seeded at build via byte-array parts
  // converted by the stub in-window: homilyChunksFor needs
  // the window, so seed through a two-step world: create
  // the world with an empty chunk list, then write into
  // the stub store through the client's own homilyDb path
  // is not exposed — the working route: build the world
  // with idbChunks as {id: [Uint8Array parts]} handled by
  // stubHomilyIdb? It stores parts as-is; homilyTakeBlob
  // joins them into a Blob — Uint8Array parts are valid
  // BlobParts. Use that.
  const half = Math.floor(TAKE.length / 2);
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([HOM_ENTRY]) }), undefined,
    { 'v643-hom-1': [TAKE.subarray(0, half), TAKE.subarray(half)] });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const rec = { begin: [], chunks: [], end: [], track: [] };
  stubBridge643(w, rec, 'file');
  const copied = [];
  stubClipboard(w, copied);
  O.shareTrackSheet(homilyDesc());
  await sleep(80);
  const sheet = d.querySelector('.sharesheet');
  check('G5 ◆ APK world: the homily sheet stands WITH the Share… row (the file route stands)',
    !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(400);
  const joined = Buffer.concat(rec.chunks.map((b64) => Buffer.from(b64, 'base64')));
  check('G5 ◆ the bridge is called begin → chunks → end exactly once each in order, with title · fileName · mimeType, and the chunks reassemble to the take\'s EXACT bytes',
    rec.begin.length === 1 && rec.end.length === 1 && rec.chunks.length === Math.ceil(TAKE.length / 262144)
    && rec.begin[0].title === 'Sunday Homily' && rec.begin[0].fileName === 'Sunday Homily.webm' && rec.begin[0].mimeType === 'audio/webm'
    && joined.equals(Buffer.from(TAKE)),
    { begin: rec.begin.length, chunks: rec.chunks.length, end: rec.end.length, bytesOk: joined.equals(Buffer.from(TAKE)) });
  check('G5 ◆ no link route fires for a homily: shareTrack never called, nothing copied',
    rec.track.length === 0 && copied.length === 0, { track: rec.track.length, copied });
  w.close();
}
{
  // In-day homily takes the same file route.
  const half = Math.floor(TAKE.length / 2);
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([HOM_ENTRY]) }), undefined,
    { 'v643-hom-1': [TAKE.subarray(0, half), TAKE.subarray(half)] });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const rec = { begin: [], chunks: [], end: [], track: [] };
  stubBridge643(w, rec, 'file');
  const hd = homilyDesc();
  await paintSynthetic(w, [hd]); // the descriptor stands IN the presented day
  O.shareTrackSheet(hd);
  await sleep(80);
  const sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(400);
  check('G5 ◆ an IN-DAY homily descriptor takes the file route too (never a ?s=day link): begin/end called, shareTrack silent',
    rec.begin.length === 1 && rec.end.length === 1 && rec.track.length === 0,
    { begin: rec.begin.length, end: rec.end.length, track: rec.track.length });
  w.close();
}
{
  // File-capable web world.
  const half = Math.floor(TAKE.length / 2);
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([HOM_ENTRY]) }), undefined,
    { 'v643-hom-1': [TAKE.subarray(0, half), TAKE.subarray(half)] });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const shared = [];
  try {
    Object.defineProperty(w.navigator, 'share', { value: (p) => { shared.push(p); return Promise.resolve(); }, configurable: true });
    Object.defineProperty(w.navigator, 'canShare', { value: (p) => !!(p && p.files && p.files.length), configurable: true });
  } catch (e) {}
  O.shareTrackSheet(homilyDesc());
  await sleep(80);
  const sheet = d.querySelector('.sharesheet');
  check('G5 ◆ file-capable web world: the sheet stands the Share… row',
    !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(400);
  const f = shared[0] && shared[0].files && shared[0].files[0];
  check('G5 ◆ navigator.share receives the File: the entry\'s file name, its mime type, and the take\'s exact size',
    shared.length === 1 && !!f && f.name === 'Sunday Homily.webm' && f.type === 'audio/webm' && f.size === TAKE.length,
    { shared: shared.length, f: f && { name: f.name, type: f.type, size: f.size } });
  w.close();
}
{
  // No-file-route world: old APK (bridge without shareFile), no navigator.share.
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([HOM_ENTRY]) }), undefined,
    { 'v643-hom-1': [TAKE.subarray(0, 100)] });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const rec = { begin: [], chunks: [], end: [], track: [] };
  stubBridge643(w, rec, 'old');
  const copied = [];
  stubClipboard(w, copied);
  O.shareTrackSheet(homilyDesc());
  await sleep(80);
  const sheet = d.querySelector('.sharesheet');
  const line = sheet && sheet.querySelector('[data-homilyline]');
  check('G5 ◆ no-file-route world: no dead Share… row — Copy link stands with the named line',
    !!sheet && !sheet.querySelector('[data-sharego]') && !!sheet.querySelector('[data-sharecopy]')
    && !!line && line.textContent.includes('The recording itself can be sent from the app on the phone.'),
    { line: line && line.textContent });
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(80);
  check('G5 ◆ its copy path writes the ?s=homily link (which lands the receiver on the plain app)',
    copied[0] === 'https://app.orapronobis.media/?s=homily&id=v643-hom-1', { copied });
  w.close();
}
{
  // Note-only entry shares its note text, no file.
  const NOTE = 'Remember the candles for Sunday.';
  const entry = Object.assign({}, HOM_ENTRY, { id: 'v643-note-1', name: 'Note Homily', state: 'note', mimeType: '', chunkCount: 0, sizeBytes: 0, note: NOTE });
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([entry]) }));
  await sleep(400);
  const O = w.__opn, d = w.document;
  const rec = { begin: [], chunks: [], end: [], track: [] };
  stubBridge643(w, rec, 'file');
  const desc = synthTrack({ episodeId: 'homily:v643-note-1', kind: 'homily', homilyId: 'v643-note-1', title: 'Note Homily', url: null, streamUrl: null, available: false });
  O.shareTrackSheet(desc);
  await sleep(80);
  const sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(150);
  check('G5 ◆ a note-only entry shares its NOTE TEXT through the standing text route and no file route fires',
    rec.track.length === 1 && rec.track[0].text === NOTE && rec.begin.length === 0,
    { track: rec.track, begin: rec.begin.length });
  w.close();
}

// ---------- G6 ◆ public surface, signed-out ----------
{
  REQUESTS.length = 0;
  const w = makeWorld({}); // no personal-data store: signed-out
  await sleep(400);
  const O = w.__opn, d = w.document;
  const own = synthTrack({ episodeId: 'v643-own-1', title: 'Ora Episode One', descText: 'Episode description stands here.', hasText: true, textUrl: '/api/player/text/' + DATE + '/v643-own-1', streamUrl: 'https://example.invalid/own1.mp3', url: 'https://example.invalid/own1.mp3', durationS: 60 });
  await paintSynthetic(w, [own]);
  await waitSettled(w);
  standDescs(w, [own], 2000);
  const reqMark = REQUESTS.length; // the page's own requests count from the landing, not the app boot's
  O.shareLandingSet({ s: 'day', date: DATE, id: 'v643-own-1' });
  O.shareLandingConsume();
  await sleep(1200);
  const page = d.querySelector('#track-page-643');
  const html = page ? page.innerHTML : '';
  const badReq = REQUESTS.slice(reqMark).filter((u) => /conscience|vault|day-additions|trackdraw|played-state|day-positions/i.test(u));
  check('G6 ◆ signed-out on the public host shape, the page paints from the public reads alone and its HTML carries NO personal data (no intention text/draw, no Conscience, no additions, no played/position, no vault field)',
    !!page && !/intention|conscience|track-draw|vault/i.test(html) && !html.includes('data-trackkey'),
    { html: html.slice(0, 300) });
  check('G6 ◆ every request the PAGE makes (from the landing on) is a public read (no personal-data endpoint is touched)',
    badReq.length === 0 && REQUESTS.length > reqMark,
    { badReq, total: REQUESTS.length - reqMark });
  w.close();
}

console.log('\nharness-v643:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
