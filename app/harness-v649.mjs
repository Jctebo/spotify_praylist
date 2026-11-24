// harness-v649.mjs — v649: the field failure of v648 —
//  the Sing the Hours title stands, Divine Office audio
//  plays. Three seams (doc §2/§3):
//   1. ADOPTION: a boot-restored queue the user has not
//      touched this session no longer blocks the v647
//      adoption forever (opnSafe647 reads the untouched
//      stand, state.restoredStand649).
//   2. ENCLOSURE STAMP: a cached ext-audio entry is bound
//      to the enclosure its bytes were fetched for
//      ('x-opn-enclosure' header at BOTH day-keyed put
//      sites); extRestoreCached + the offline pass's reuse
//      read compare the stamp — mismatch or absence is a
//      miss and the slot re-downloads through the standing
//      routes.
//   3. FLIP HEAL: the resettle hook's no-change branch
//      verifies the labeled slot's stamp before no-oping;
//      on mismatch/absence it evicts and re-settles through
//      settleMeta under a taken epoch.
//
// Legs (doc §4):
//  G1 (fail-on-old): pin pend + boot-restored untouched
//      queue -> adoption fires at the re-check tick.
//      G1b: + one session play act (resumeCurrent) ->
//      still blocked. G1c: gate paint / edit form /
//      sounding transport still block.
//  G2 (fail-on-old): the field world (whole StH record +
//      UNSTAMPED Divine Office bytes under its key) ->
//      open -> the labeled slot re-downloads via
//      pass-through&src=Sing the Hours; the blob the play
//      path mints is the StH item; record whole. On the
//      base client the restore mints the DO bytes.
//  G2b: the offline pass's reuse read applies the same
//      compare (unstamped poison -> re-fetch + re-stamp;
//      stamped match -> standing, no fetch).
//  G3 (fail-on-old): poison standing in-session under the
//      StH record -> flip DO then back through the
//      Edit-form handler -> next play's bytes are StH; a
//      single flip to DO settles title+audio DO whole.
//      G3b: a no-change tap on the standing choice heals
//      the poisoned entry in place (Seam 3 direct).
//  G4: nativeContractItem carries &src=Sing the Hours
//      (StH first) / &src=Divine Office (DO first).
//  G5: Evening mirrors G2/G3 (asserted in those legs).
//  G6: whole record + STAMPED entry matching its
//      enclosure -> restore untouched, no fetch, blob
//      byte-identical.
//
// Fixtures (Improvement D — production sources, named):
//  the REAL 2026-11-24 live payload shape (harness-v648's
//  LIVE648: both labeled rows whole, DO standing + StH
//  backup whole); the queue snapshot shape (opn-queue-v355
//  v2 record, derived from a real build's descriptors);
//  a Cache API entry holding Divine Office bytes with NO
//  stamp under a whole-fields Sing the Hours record (the
//  field state). The fake Cache API here preserves
//  Response headers, as the real Cache API does.
//
// Run: node app/harness-v649.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 450)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const BASE = git(['rev-parse', 'b78f481']).trim(); // production pin ora-pro-nobis-v648-1 tree
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
// Seam 4a's tree: the PRE-v648 client (v647, 0bd6980) —
// the client a phone stuck behind Seam 1 actually runs;
// its flip downloads through the src-less pass-through.
const client647Src = git(['show', '0bd6980:app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- Statics ----------
{
  check('S1 extDownload stamps its put: pass-through fetches stamp the meta enclosureUrl, direct fetches the fetched URL',
    grab(clientSrc, 'resolveExternals').includes("var stamp649 = (u === passthrough) ? meta.enclosureUrl : u;")
    && grab(clientSrc, 'resolveExternals').includes('opnStampedResponse649(blob, stamp649)'), {});
  check('S2 the offline pass stamps its put with the item enclosure and its reuse read is the stamp compare (offlineStanding649)',
    clientSrc.includes('offlinePutBlob(cache, it.key, blob, it.enclosureUrl)')
    && clientSrc.includes('return offlineStanding649(cache, it).then(function (has)')
    && grab(clientSrc, 'offlineStanding649').includes("it.kind !== 'ext'") && grab(clientSrc, 'offlineStanding649').includes('opnStampMatches649(resp, it.enclosureUrl)'), {});
  check('S3 extRestoreCached compares the stamp to the record enclosure before minting (mismatch/absence -> extDownload)',
    grab(clientSrc, 'resolveExternals').includes('if (!opnStampMatches649(resp, meta.enclosureUrl)) { done = true; clearTimeout(fallback); extDownload(slot, meta); return; }'), {});
  check('S4 the flip heal stands in the resettle no-change branch (stamp verify; evict + settleMeta under a taken epoch on mismatch)',
    grab(clientSrc, 'resolveExternals').includes('healLabeledStamp649(slot, choice638, e); return;')
    && grab(clientSrc, 'resolveExternals').includes('if (opnStampMatches649(resp, choice638.streamUrl)) return;')
    && grab(clientSrc, 'resolveExternals').includes('cache.delete(offlineDayKey(date, slot.slotId))'), {});
  check('S5 adoption: opnSafe647 blocks on current/queue only when the stand is not the untouched restore; both restore stands mark it, the touch helper stands',
    grab(clientSrc, 'opnSafe647').includes('if (!state.restoredStand649)')
    && grab(clientSrc, 'standRestoredQueue').includes('state.restoredStand649 = true')
    && grab(clientSrc, 'tryStandPodcastRestore').includes('state.restoredStand649 = true')
    && grab(clientSrc, 'resumeCurrent').includes('opnTouchRestored649()')
    && grab(clientSrc, 'startDesc').includes('opnTouchRestored649()'), {});
}

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const appJsOld = renderJs(clientOldSrc);
const appJs647 = renderJs(client647Src);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S6 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, VirtualConsole, webcrypto;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM, VirtualConsole } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v649:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const STH_KEY = 'opn-sth-first-v632';
const EXT_CACHE_KEY = 'opn-ext-cache-v1';
const QUEUE_KEY = 'opn-queue-v355';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const SEED_ROWS = (() => {
  const at = appJs.indexOf('var OPN_SEED_SOURCES = ');
  const end = appJs.indexOf('];', at);
  return vm.runInContext('(' + appJs.slice(at + 'var OPN_SEED_SOURCES = '.length, end + 1) + ')', vm.createContext({}));
})();
const HOOK = '\n;window.__opn = { state, opn604, audioEl, opnFoldDay590, paintPrayersView, extRebuildDescs, renderPrayersSide, resumeCurrent, nativeContractItem, offlineDownloadItemsCache, opnSthFirstSet632,'
  + ' opn647: (typeof opnCheck647 === "function") ? { check: opnCheck647, tryAdopt: opnTryAdopt647, safe: opnSafe647, runPin: function () { return opnRunPin647; }, pend: function () { return opnPend647; }, rec: opnAdoptRec647 }'
  + ' : { check: function () {}, tryAdopt: function () {}, safe: function () { return null; }, runPin: function () { return null; }, pend: function () { return null; }, rec: function () { return null; } } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };

// The real 2026-11-24 live payload shape (harness-v648).
const DO_IMG = 'https://do.example/divine-office-logo.jpg';
const STH_IMG = 'https://sth.example/sing-the-hours-channel.jpg';
const DO_MP = 'https://do.example/divine-1124-mp.mp3';
const DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3';
const STH_EP = 'https://sth.example/vespers-1124.mp3';
const LIVE648 = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: DO_MP, durationSec: 754, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_MP, source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', imageUrl: STH_IMG } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: DO_EP, durationSec: 754, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_EP, source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours', imageUrl: STH_IMG } },
]};
let LIVE_NOW = LIVE648;
let FETCHLOG = [];
let SERVED = 'ora-pro-nobis-v648-1';
const PIN_NEW = 'ora-pro-nobis-v649-1';
function bytesFor(u) {
  if (u.includes('/api/player/externals/audio')) {
    const q = new URL(u, 'https://app.orapronobis.media').searchParams;
    return q.get('src') === 'Sing the Hours' ? 'STH-AUDIO-BYTES' : 'DO-AUDIO-BYTES';
  }
  if (u.startsWith('https://do.example/')) return 'DO-AUDIO-BYTES';
  if (u.startsWith('https://sth.example/')) return 'STH-AUDIO-BYTES';
  return 'X-BYTES';
}
function fetchStub(url) {
  const u = String(url);
  FETCHLOG.push(u);
  if (u.includes('/sw.js')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('var CACHE = "' + SERVED + '";\n') });
  let body = {};
  if (u.includes('/api/player/source-settings')) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes('/api/player/externals/live')) body = LIVE_NOW;
  else if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob([bytesFor(u)], { type: 'audio/mpeg' })) });
}
// A Cache API fake that PRESERVES Response headers (the
// real Cache API does): bytes in _store (string-valued,
// the harness-v648 convention), stamps in _stamps.
function makeFakeCaches() {
  const store = new Map(); const stamps = new Map();
  const cache = {
    put: (k, resp) => { const s = resp.headers.get('x-opn-enclosure'); return Promise.resolve(resp.blob()).then((b) => b.text()).then((t) => { store.set(String(k), t); if (s) stamps.set(String(k), s); else stamps.delete(String(k)); }); },
    match: (k) => { const t = store.get(String(k)); if (t === undefined) return Promise.resolve(undefined); const h = { 'Content-Type': 'audio/mpeg' }; const s = stamps.get(String(k)); if (s) h['x-opn-enclosure'] = s; return Promise.resolve(new Response(t, { headers: h })); },
    delete: (k) => { stamps.delete(String(k)); return Promise.resolve(store.delete(String(k))); },
    keys: () => Promise.resolve([...store.keys()].map((u) => ({ url: u }))),
  };
  return { open: () => Promise.resolve(cache), delete: () => Promise.resolve(true), _store: store, _stamps: stamps };
}
function makeWorld(js, store) {
  const vc = new VirtualConsole();
  const counter = { reloads: 0, updates: 0 };
  vc.on('jsdomError', (e) => { if (/navigation/.test(e.message)) counter.reloads++; });
  const mints = [];
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  const fakeReg = { update: function () { counter.updates++; return Promise.resolve(); } };
  try { Object.defineProperty(w.navigator, 'serviceWorker', { value: { register: function () { return Promise.resolve(fakeReg); } }, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  try { w.URL.createObjectURL = (blob) => { try { blob.text().then((t) => mints.push(t)); } catch (e) {} return 'blob:fake-' + Math.random(); }; w.URL.revokeObjectURL = () => {}; } catch (e) {}
  try { w.Response = Response; w.Blob = Blob; } catch (e) {}
  const fakeCaches = makeFakeCaches();
  try { w.caches = fakeCaches; } catch (e) {}
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return { w, fakeCaches, counter, mints };
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function johnStore(extra) { return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN) }, extra || {}); }
function publicDay(date) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: ['x', 'y'].map((t, i) => ({ episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: 2,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY));
    O.state.dayPayload = day;
    O.extRebuildDescs(day);
    O.paintPrayersView(day);
    return day;
  };
  paint();
  await sleep(600);
  paint();
}
async function enterEdit(w) {
  const d = w.document;
  if (!d.querySelector('[data-p604erow]')) {
    click(w, d.querySelector('[data-p607edit]'));
    const quick = await until(() => d.querySelector('[data-p604erow]'), 4000);
    if (!quick) { await paintHome(w); click(w, d.querySelector('[data-p607edit]')); await until(() => d.querySelector('[data-p604erow]'), 9000); }
  }
  return !!d.querySelector('[data-p604erow]');
}
function slotOf(w, sid) { const O = w.__opn; return O.state.extSlots && O.state.extSlots[sid]; }
function descOf(w, sid) { const O = w.__opn; return (O.state.dayDescs || []).find((d) => d.episodeId === sid) || null; }
async function buildDay(w) {
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present'; }, 15000);
  await sleep(500);
  return built;
}
async function flip(w, which) {
  const entered = await enterEdit(w);
  if (!entered) return false;
  click(w, w.document.querySelector('[data-p637sth="' + which + '"]'));
  return true;
}
const CDATE = '2026-11-21';
const audioKey = (sid) => 'day/' + CDATE + '/' + sid;
function dumpStore(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}
// The client's OWN written whole StH-choice day cache
// (the harness-v648 L4/L12 recipe): a first build under
// Sing the Hours first, dumped whole.
async function writtenCacheStore(js) {
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w } = makeWorld(js, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  await buildDay(w);
  const store = dumpStore(w);
  w.close();
  return store;
}

// ---------- G2 ◆ (fail-on-old): the field world ----------
async function fieldWorld(js) {
  const store = await writtenCacheStore(js);
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const world = makeWorld(js, store);
  // The poison: Divine Office bytes under both labeled
  // keys, NO stamp — the pre-v649 entry exactly.
  world.fakeCaches._store.set(audioKey('ext-morning-prayer'), 'DO-AUDIO-BYTES');
  world.fakeCaches._store.set(audioKey('ext-evening-prayer'), 'DO-AUDIO-BYTES');
  await sleep(400);
  const built = await buildDay(world.w);
  return { ...world, built };
}
{
  const { w, fakeCaches, mints, built } = await fieldWorld(appJs);
  await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES', 8000);
  await sleep(400);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  check('G2 ◆ field world, new client: the labeled slot RE-DOWNLOADS through pass-through&src=Sing the Hours (the unstamped entry reads as a miss) and the cache lands the Sing the Hours bytes, stamped with the StH enclosure',
    built && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours'))
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES'
    && fakeCaches._stamps.get(audioKey('ext-morning-prayer')) === STH_MP,
    { bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), stamp: fakeCaches._stamps.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  check('G2 ◆ the blob the play path mints for the slot is the Sing the Hours item, and the record stands whole (StH title · source · castos enclosure · StH image)',
    mints.includes('STH-AUDIO-BYTES') && !mints.includes('DO-AUDIO-BYTES')
    && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Sing the Hours' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP && mp.imageUrl === STH_IMG,
    { mints, mp: mp && { title: mp.title, source: mp.source, enclosureUrl: mp.enclosureUrl, imageUrl: mp.imageUrl } });
  check('G5 ◆ Evening mirrors G2: re-download via src=Sing the Hours, StH bytes stamped with the StH vespers enclosure, record whole',
    !!ep && ep.state === 'present' && ep.source === 'Sing the Hours' && ep.enclosureUrl === STH_EP && ep.imageUrl === STH_IMG
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'STH-AUDIO-BYTES'
    && fakeCaches._stamps.get(audioKey('ext-evening-prayer')) === STH_EP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-evening-prayer') && u.includes('src=Sing%20the%20Hours')),
    { ep: ep && { source: ep.source, enclosureUrl: ep.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-evening-prayer')) });
  // G4 (StH side): the engine contract under the healed state
  const desc = descOf(w, 'ext-morning-prayer');
  const item = desc ? drive(() => w.__opn.nativeContractItem(desc)) : null;
  check('G4 ◆ nativeContractItem for the labeled slot carries &src=Sing the Hours under the healed Sing the Hours-first state',
    !!item && typeof item.mediaUri === 'string' && item.mediaUri.includes('/api/player/externals/audio') && item.mediaUri.includes('&src=Sing%20the%20Hours'),
    { item: item && { mediaUri: item.mediaUri } });
  w.close();
}
{
  // Fail-on-old: the BASE client (v648) in the SAME field
  // world — its restore trusts the unstamped entry and
  // mints the Divine Office bytes under the StH record.
  const { w, fakeCaches, mints, built } = await fieldWorld(appJsOld);
  await sleep(600);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('G2-old ◆ REPRODUCED on the base client (v648): the restore mints the DIVINE OFFICE bytes under the whole Sing the Hours record — title right, audio wrong (John\'s row)',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP
    && mints.includes('DO-AUDIO-BYTES')
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES'
    && !FETCHLOG.some((u) => u.includes('externals/audio') && u.includes('slot=ext-morning-prayer')),
    { mints, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  w.close();
}

// ---------- G2b ◆: the offline pass's reuse read ----------
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const O = w.__opn;
  const item = { kind: 'ext', date: CDATE, id: 'ext-morning-prayer', enclosureUrl: STH_MP, source: 'Sing the Hours', key: audioKey('ext-morning-prayer') };
  fakeCaches._store.set(item.key, 'DO-AUDIO-BYTES'); // unstamped poison standing
  const res1 = await O.offlineDownloadItemsCache([item], null);
  check('G2b ◆ offline pass: an UNSTAMPED entry under an ext item reads as a miss — the pass re-fetches through pass-through&src=Sing the Hours and re-stamps the entry',
    !!res1 && res1.have === 1 && fakeCaches._store.get(item.key) === 'STH-AUDIO-BYTES' && fakeCaches._stamps.get(item.key) === STH_MP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('src=Sing%20the%20Hours')),
    { res1, bytes: fakeCaches._store.get(item.key), stamp: fakeCaches._stamps.get(item.key) });
  FETCHLOG = [];
  const res2 = await O.offlineDownloadItemsCache([item], null);
  check('G2b ◆ offline pass: a STAMPED entry matching the item enclosure stands — counted present, no fetch fires',
    !!res2 && res2.have === 1 && fakeCaches._store.get(item.key) === 'STH-AUDIO-BYTES'
    && !FETCHLOG.some((u) => u.includes('externals/audio')),
    { res2, fetches: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}

// ---------- G3 ◆ (fail-on-old): the flip, with poison standing in-session ----------
async function poisonedSession(js) {
  // A healed session first (StH settled whole, stamped),
  // then the poison lands IN-SESSION: the entry under the
  // standing StH record is replaced by unstamped DO bytes
  // (the shape a pre-v649 pass/write left behind).
  const world = await fieldWorld(js);
  world.fakeCaches._store.set(audioKey('ext-morning-prayer'), 'DO-AUDIO-BYTES');
  world.fakeCaches._stamps.delete(audioKey('ext-morning-prayer'));
  world.fakeCaches._store.set(audioKey('ext-evening-prayer'), 'DO-AUDIO-BYTES');
  world.fakeCaches._stamps.delete(audioKey('ext-evening-prayer'));
  FETCHLOG = [];
  return world;
}
{
  const { w, fakeCaches } = await poisonedSession(appJs);
  // Single flip to Divine Office: title + audio DO whole.
  await flip(w, 'do');
  const toDo = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office' && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES'; }, 12000);
  await sleep(300);
  const mpDo = slotOf(w, 'ext-morning-prayer');
  check('G3 ◆ a single flip to Divine Office settles title + audio Divine Office WHOLE (DO title · DO enclosure · DO image · DO bytes stamped with the DO enclosure)',
    toDo && !!mpDo && mpDo.title === 'Morning Prayer - Divine Office' && mpDo.enclosureUrl === DO_MP && mpDo.imageUrl === DO_IMG
    && fakeCaches._stamps.get(audioKey('ext-morning-prayer')) === DO_MP,
    { mpDo: mpDo && { title: mpDo.title, enclosureUrl: mpDo.enclosureUrl, imageUrl: mpDo.imageUrl }, stamp: fakeCaches._stamps.get(audioKey('ext-morning-prayer')) });
  // G4 (DO side)
  const descDo = descOf(w, 'ext-morning-prayer');
  const itemDo = descDo ? drive(() => w.__opn.nativeContractItem(descDo)) : null;
  check('G4 ◆ nativeContractItem carries &src=Divine Office under Divine Office first',
    !!itemDo && typeof itemDo.mediaUri === 'string' && itemDo.mediaUri.includes('&src=Divine%20Office'),
    { itemDo: itemDo && { mediaUri: itemDo.mediaUri } });
  // Flip back to Sing the Hours.
  click(w, w.document.querySelector('[data-p607done]'));
  await sleep(300);
  await flip(w, 'sth');
  const back = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours' && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES'; }, 12000);
  await sleep(300);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  check('G3 ◆ flip back to Sing the Hours: the next play\'s bytes are the Sing the Hours item (cache re-downloaded via src=Sing the Hours, stamped StH), record whole',
    back && !!mp && mp.title === 'Morning Prayer - Sing the Hours' && mp.enclosureUrl === STH_MP && mp.imageUrl === STH_IMG
    && fakeCaches._stamps.get(audioKey('ext-morning-prayer')) === STH_MP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { mp: mp && { title: mp.title, enclosureUrl: mp.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  check('G5 ◆ Evening mirrors G3 across the same flips: StH whole with StH bytes at the end',
    !!ep && ep.state === 'present' && ep.source === 'Sing the Hours' && ep.enclosureUrl === STH_EP
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'STH-AUDIO-BYTES',
    { ep: ep && { source: ep.source }, bytes: fakeCaches._store.get(audioKey('ext-evening-prayer')) });
  w.close();
}
{
  // G3b: the no-change resettle heals in place (Seam 3
  // direct). The standing choice's chip renders as a
  // "Standing" span (client.ts opnSthChoiceHtml637) — no
  // button exists for it — so the leg drives the Edit-form
  // handler's exact two calls (the store write for the
  // standing value + the hook) the way a chip tap does.
  const { w, fakeCaches } = await poisonedSession(appJs);
  const O = w.__opn;
  drive(() => { O.opnSthFirstSet632(true); return O.state.extResettleLabeled638(); });
  const healed = await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES' && fakeCaches._stamps.get(audioKey('ext-morning-prayer')) === STH_MP, 12000);
  await sleep(300);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('G3b ◆ no-change resettle on the standing Sing the Hours choice: the heal verifies the stamp, evicts the poison, and re-settles — the entry stands Sing the Hours bytes stamped StH, fetched via pass-through&src=Sing the Hours; the record never moved',
    healed && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { mp: mp && { source: mp.source, enclosureUrl: mp.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), stamp: fakeCaches._stamps.get(audioKey('ext-morning-prayer')) });
  w.close();
}
{
  // Fail-on-old (Seam 4a): the PRE-v648 client (v647 —
  // the client Seam 1 can strand John's phone on) flipped
  // DO then back in the poisoned session — its src-less
  // pass-through re-resolves Divine Office on the way
  // back, so the StH-titled record stands over DO bytes
  // again. (The v648 client already carries src on the
  // flip's download; its G3-class failure is the restore,
  // reproduced at G2-old.)
  const { w, fakeCaches } = await poisonedSession(appJs647);
  await flip(w, 'do');
  await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office'; }, 12000);
  click(w, w.document.querySelector('[data-p607done]'));
  await sleep(300);
  await flip(w, 'sth');
  await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours'; }, 12000);
  await sleep(600);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('G3-old ◆ REPRODUCED on the pre-v648 client (v647): flip DO then back lands the StH title over DIVINE OFFICE bytes — the flip cannot change what sounds (John, 12:59 CT)',
    !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES',
    { mp: mp && { source: mp.source, enclosureUrl: mp.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  w.close();
}

// ---------- G6 ◆: stamped match restores untouched ----------
{
  const store = await writtenCacheStore(appJs);
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches, mints, built } = makeWorld(appJs, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'CACHED-STH-LAUDS-BYTES');
  fakeCaches._stamps.set(audioKey('ext-morning-prayer'), STH_MP);
  fakeCaches._store.set(audioKey('ext-evening-prayer'), 'CACHED-STH-VESPERS-BYTES');
  fakeCaches._stamps.set(audioKey('ext-evening-prayer'), STH_EP);
  await sleep(400);
  const built2 = await buildDay(w);
  await sleep(600);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('G6 ◆ whole record + STAMPED entry matching its enclosure: restore untouched — no pass-through fetch for either labeled slot, both blobs byte-identical, the minted play blob is the cached bytes',
    (built || built2) && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'CACHED-STH-LAUDS-BYTES'
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'CACHED-STH-VESPERS-BYTES'
    && mints.includes('CACHED-STH-LAUDS-BYTES')
    && !FETCHLOG.some((u) => u.includes('externals/audio') && (u.includes('slot=ext-morning-prayer') || u.includes('slot=ext-evening-prayer'))),
    { mp: mp && { source: mp.source }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}

// ---------- G1 ◆ (fail-on-old): adoption over a boot-restored queue ----------
// The snapshot is derived from a real build's descriptors
// (the probe world), in the opn-queue-v355 v2 shape.
async function snapshotStore(js) {
  LIVE_NOW = LIVE648; FETCHLOG = []; SERVED = 'ora-pro-nobis-v648-1';
  const { w } = makeWorld(js, johnStore({}));
  await sleep(400);
  await buildDay(w);
  const descs = (w.__opn.state.dayDescs || []).filter((d) => d && d.episodeId && d.available !== false).slice(0, 3);
  const store = dumpStore(w);
  w.close();
  const snap = { v: 2, date: CDATE, ids: descs.map((d) => d.episodeId), blocks: descs.map((d) => d.block || ''), idx: 0, currentId: descs[0].episodeId, currentBlock: descs[0].block || '', positionS: 0, savedAt: new Date().toISOString() };
  store[QUEUE_KEY] = JSON.stringify(snap);
  return store;
}
async function restoredWorld(js) {
  const store = await snapshotStore(js);
  LIVE_NOW = LIVE648; FETCHLOG = []; SERVED = 'ora-pro-nobis-v648-1';
  const world = makeWorld(js, store);
  await sleep(400);
  await buildDay(world.w);
  const stood = await until(() => { const O = world.w.__opn; return O.state.current && O.state.queue && O.state.queue.length >= 2; }, 12000);
  return { ...world, stood };
}
{
  const { w, counter, stood } = await restoredWorld(appJs);
  const O = w.__opn, A = O.opn647;
  check('G1 ◆ setup: the boot restore stands current + queue, untouched (restoredStand649 true, restoredQueue true)',
    stood && O.state.restoredStand649 === true && O.state.restoredQueue === true,
    { stood, flag: O.state.restoredStand649, rq: O.state.restoredQueue, q: (O.state.queue || []).length });
  // G1c blockers, each in turn, with the pin pended. The
  // sheet stands BEFORE the check runs (the v647 L1
  // recipe): opnCheck647 itself tries adoption the moment
  // it pends, so the pend must be held by a blocker first.
  const d = w.document;
  const sheet = d.createElement('div'); sheet.className = 'sheet'; d.body.appendChild(sheet);
  SERVED = PIN_NEW;
  drive(() => A.check());
  await sleep(150);
  drive(() => A.tryAdopt());
  await sleep(80);
  const blockedSheet = counter.reloads === 0 && A.safe() === false && A.pend() === PIN_NEW;
  sheet.remove();
  O.opn604.editing = true;
  const edit = d.createElement('div'); edit.className = 'p609set p609edit'; d.body.appendChild(edit);
  drive(() => A.tryAdopt());
  await sleep(80);
  const blockedEdit = counter.reloads === 0 && A.safe() === false;
  edit.remove(); O.opn604.editing = false;
  try { Object.defineProperty(O.audioEl, 'paused', { value: false, configurable: true }); } catch (e) {}
  drive(() => A.tryAdopt());
  await sleep(80);
  const blockedSounding = counter.reloads === 0 && A.safe() === false;
  try { Object.defineProperty(O.audioEl, 'paused', { value: true, configurable: true }); } catch (e) {}
  check('G1c ◆ the standing v647 blockers still block over an untouched restored queue: a sheet paint · the edit form open · a sounding transport',
    A.pend() === PIN_NEW && blockedSheet && blockedEdit && blockedSounding,
    { pend: A.pend(), blockedSheet, blockedEdit, blockedSounding, reloads: counter.reloads });
  drive(() => A.tryAdopt());
  await sleep(80);
  check('G1 ◆ pin pend + boot-restored UNTOUCHED queue: adoption fires at the re-check tick — exactly one reload, the record written for the new pin first',
    counter.reloads === 1 && A.rec() === PIN_NEW,
    { reloads: counter.reloads, rec: A.rec() });
  w.close();
}
{
  // G1b: one session play act (a resume of the restored
  // queue) touches the stand — adoption stays blocked.
  const { w, counter, stood } = await restoredWorld(appJs);
  const O = w.__opn, A = O.opn647;
  drive(() => O.resumeCurrent());
  await sleep(200);
  SERVED = PIN_NEW;
  drive(() => A.check());
  await sleep(150);
  drive(() => A.tryAdopt());
  await sleep(80);
  check('G1b ◆ the same world plus ONE session play act (resumeCurrent on the restored queue): the stand is touched and adoption stays blocked',
    stood && O.state.restoredStand649 === false && A.pend() === PIN_NEW && A.safe() === false && counter.reloads === 0,
    { stood, flag: O.state.restoredStand649, pend: A.pend(), safe: A.safe(), reloads: counter.reloads });
  w.close();
}
{
  // Fail-on-old: the base client's opnSafe647 reads the
  // standing current/queue as blocking, untouched or not.
  const { w, counter, stood } = await restoredWorld(appJsOld);
  const O = w.__opn, A = O.opn647;
  SERVED = PIN_NEW;
  drive(() => A.check());
  await sleep(150);
  drive(() => A.tryAdopt());
  await sleep(80);
  check('G1-old ◆ REPRODUCED on the base client (v648): pin pended, the boot-restored queue stands untouched, and adoption NEVER fires — the phone stays on the old build indefinitely (Seam 1)',
    stood && A.pend() === PIN_NEW && A.safe() === false && counter.reloads === 0,
    { stood, pend: A.pend(), safe: A.safe(), reloads: counter.reloads });
  w.close();
}

console.log('\nharness-v649:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
