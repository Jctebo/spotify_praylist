// harness-v650.mjs — v650: both office episodes as separate
//  tracks; paint by a drop-down setting (doc §3/§4).
//   1. BOTH SIDES SETTLE AS SIDES: the courier leg applies
//      no choice; the slot record stands as served and its
//      backup is promoted to record.side2, each side
//      downloading its own bytes through its own routes.
//   2. PER-SIDE BYTE IDENTITY: extAudioKey650 keys a labeled
//      side 'day/<date>/<slot>~<tag>'; the v649 stamp rule
//      stands per side; the mint owner is per-side.
//   3. EMISSION + IDENTITY: one descriptor per painting
//      side in paint order; identity follows paint position
//      (first = standing identity, second carries _side650).
//   4. DROP DOWN + STORE: opn-office-choice-v650
//      ('do'|'sth'|'both'), migration at first read, the
//      Edit-form <select data-p650office>, in-session repaint.
//
// Legs (doc §4): G1 default 'Sing the Hours' · G2 'Divine
//  Office' · G3 'Both' (order, per-side marks + draws) ·
//  G4 per-side bytes (fail-on-old shapes) · G5 in-session
//  re-paint · G6 a side missing · G7 migration · G8 contents
//  duplicate × 'Both' · G9 engine hand-off per descriptor ·
//  G10 Evening mirror.
//
// Fixtures (Improvement D — production sources, named):
//  the REAL 2026-11-24 live payload shape (Review Probe D
//  at v649): both labeled rows whole — standing Divine
//  Office (blubrry stream · DO logo · durationSec Morning
//  1091 / Evening 880) with a whole Sing the Hours backup
//  (castos stream · StH image · durationSec Morning 1034 /
//  Evening 869). This fixture carries BOTH sides' durationSec
//  (the v649 observation-3 gap, closed here).
//
// Run: node app/harness-v650.mjs
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
const BASE = git(['rev-parse', 'b78f481']).trim(); // production pin ora-pro-nobis-v648-1 tree (the v650 base's parent shape)
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
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
  check('S1 retirements stand deleted: opnExtChoice628 · healLabeledStamp649 · state.extResettleLabeled638 · the epoch/prior maps have no live code',
    !clientSrc.includes('function opnExtChoice628(') && !clientSrc.includes('healLabeledStamp649 = function') && !clientSrc.includes('state.extResettleLabeled638 = function')
    && !clientSrc.includes('var extResettleEpoch638 = {}') && !clientSrc.includes('var extResettlePrior638 = {}'), {});
  check('S2 the drop down stands at the Edit-form seat: opnOfficeChoiceHtml650 emits <select data-p650office> with the three values, and opnEditSetHtml609 paints it',
    grab(clientSrc, 'opnOfficeChoiceHtml650').includes('<select data-p650office') && grab(clientSrc, 'opnOfficeChoiceHtml650').includes("opt650('both', 'Both')")
    && grab(clientSrc, 'opnEditSetHtml609').includes('opnOfficeChoiceHtml650()') && !clientSrc.includes('function opnSthChoiceHtml637('), {});
  check('S3 the change handler is paint-only: store write -> extRebuildDescs(state.dayPayload) + opnRepaintHome604(), no live-payload fetch in the handler',
    clientSrc.includes("sel.addEventListener('change', function () { opnOfficeChoiceSet650(sel.value); if (state.dayPayload) extRebuildDescs(state.dayPayload); opnRepaintHome604(); });"), {});
  check('S4 per-side keys: extAudioKey650 tags a labeled side, the bare key stands for unlabeled slots; descCardKey/descMarkKey append \'@\' + tag',
    grab(clientSrc, 'extAudioKey650').includes("slotId + '~' + extSideTag650(source)")
    && grab(clientSrc, 'descCardKey').includes("t._side650 ? '@' + t._side650 : ''")
    && grab(clientSrc, 'descMarkKey').includes('t._side650 || null'), {});
  check('S5 the migration reader stands: opnOfficeChoice650 reads the new store, migrates through opnSthPrimary628 one last time, defaults \'sth\'',
    grab(clientSrc, 'opnOfficeChoice650').includes("OPN_OFFICE_CHOICE_KEY650") && grab(clientSrc, 'opnOfficeChoice650').includes('opnSthPrimary628()')
    && clientSrc.includes("var OPN_OFFICE_CHOICE_KEY650 = 'opn-office-choice-v650';"), {});
}

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const appJsOld = renderJs(clientOldSrc);
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
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v650:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const STH_KEY = 'opn-sth-first-v632';
const CHOICE_KEY = 'opn-office-choice-v650';
const PIN_KEY = 'opn-pin-local-v1';
const QUEUE_KEY = 'opn-queue-v355';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const SEED_ROWS = (() => {
  const at = appJs.indexOf('var OPN_SEED_SOURCES = ');
  const end = appJs.indexOf('];', at);
  return vm.runInContext('(' + appJs.slice(at + 'var OPN_SEED_SOURCES = '.length, end + 1) + ')', vm.createContext({}));
})();
const HOOK = '\n;window.__opn = { state, opn604, audioEl, opnFoldDay590, paintPrayersView, extRebuildDescs, renderPrayersSide, nativeContractItem, offlineDownloadItemsCache, offlineEnumerateToday, descMarkKey, descCardKey, isPlayedDesc, markCompleted, opnCounts615, trackKeyOf,'
  + ' opnOfficeChoice650: (typeof opnOfficeChoice650 === "function") ? opnOfficeChoice650 : function () { return null; },'
  + ' opnOfficeChoiceSet650: (typeof opnOfficeChoiceSet650 === "function") ? opnOfficeChoiceSet650 : function () {},'
  + ' extAudioKey650: (typeof extAudioKey650 === "function") ? extAudioKey650 : function () { return null; } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };

// The real 2026-11-24 live payload shape, both sides whole
// incl. durationSec (§2.6).
const DO_IMG = 'https://do.example/divine-office-logo.jpg';
const STH_IMG = 'https://sth.example/sing-the-hours-channel.jpg';
const DO_MP = 'https://do.example/divine-1124-mp.mp3';
const DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3';
const STH_EP = 'https://sth.example/vespers-1124.mp3';
const LIVE650 = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_MP, source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', imageUrl: STH_IMG, durationSec: 1034 } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: DO_EP, durationSec: 880, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_EP, source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours', imageUrl: STH_IMG, durationSec: 869 } },
]};
const LIVE_NOBACKUP = { slots: LIVE650.slots.map((s) => { const c = Object.assign({}, s); delete c.backup; return c; }) };
const LIVE_STH_ONLY = { slots: LIVE650.slots.map((s) => ({ slotId: s.slotId, state: 'present', title: s.backup.title, streamUrl: s.backup.streamUrl, durationSec: s.backup.durationSec, sizeBytes: 900000, imageUrl: STH_IMG, source: 'Sing the Hours' })) };
let LIVE_NOW = LIVE650;
let FETCHLOG = [];
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
  if (u.includes('/sw.js')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('var CACHE = "ora-pro-nobis-v650-1";\n') });
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
function slotOf(w, sid) { const O = w.__opn; return O.state.extSlots && O.state.extSlots[sid]; }
function descsOf(w, sid) { const O = w.__opn; return (O.state.dayDescs || []).filter((d) => d.episodeId === sid); }
async function buildDay(w) {
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.side2 && mp.side2.state === 'present'; }, 15000);
  await sleep(500);
  return built;
}
const CDATE = '2026-11-21';
const sideKey = (sid, tag) => 'day/' + CDATE + '/' + sid + '~' + tag;
const bareKey = (sid) => 'day/' + CDATE + '/' + sid;
function dumpStore(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}
async function writtenCacheStore(js, extra) {
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(js, johnStore(extra || {}));
  await sleep(400);
  await buildDay(w);
  const store = dumpStore(w);
  w.close();
  return store;
}
async function enterEdit(w) {
  const d = w.document;
  if (!d.querySelector('[data-p650office]')) {
    click(w, d.querySelector('[data-p607edit]'));
    const quick = await until(() => d.querySelector('[data-p650office]'), 5000);
    if (!quick) { await sleep(600); click(w, d.querySelector('[data-p607edit]')); await until(() => d.querySelector('[data-p650office]'), 9000); }
  }
  return !!d.querySelector('[data-p650office]');
}

// ---------- G1 ◆ default 'Sing the Hours' (+ G10 Evening durations) ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w, fakeCaches, built } = await (async () => { const world = makeWorld(appJs, johnStore({})); await sleep(400); const b = await buildDay(world.w); return { ...world, built: b }; })();
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descsOf(w, 'ext-morning-prayer'), epD = descsOf(w, 'ext-evening-prayer');
  check('G1 ◆ default (nothing standing): the migration defaults to \'sth\', written once to the new store; ONE Morning track paints — the Sing the Hours record whole (its title · StH image · duration 1034)',
    built && w.__opn.opnOfficeChoice650() === 'sth' && w.localStorage.getItem(CHOICE_KEY) === 'sth'
    && mpD.length === 1 && mpD[0].source === 'Sing the Hours' && mpD[0].title === 'Morning Prayer - Sing the Hours' && mpD[0].imageUrl === STH_IMG && mpD[0].durationS === 1034 && !mpD[0]._side650,
    { n: mpD.length, d: mpD[0] && { source: mpD[0].source, title: mpD[0].title, durationS: mpD[0].durationS } });
  check('G1 ◆ both sides stand on the record as sides: standing fields = the served Divine Office side whole, side2 = the Sing the Hours side whole (own enclosure · own minted stream · present)',
    !!mp && mp.source === 'Divine Office' && mp.enclosureUrl === DO_MP && mp.durationSec === 1091 && mp.imageUrl === DO_IMG
    && !!mp.side2 && mp.side2.state === 'present' && mp.side2.source === 'Sing the Hours' && mp.side2.enclosureUrl === STH_MP && mp.side2.durationSec === 1034 && mp.side2.imageUrl === STH_IMG && !!mp.side2.streamUrl,
    { mp: mp && { source: mp.source, side2: mp.side2 && { source: mp.side2.source, durationSec: mp.side2.durationSec } } });
  check('G1 ◆ per-side bytes landed under per-side keys, each stamped with its own enclosure (DO direct · StH via pass-through&src=Sing the Hours)',
    fakeCaches._store.get(sideKey('ext-morning-prayer', 'do')) === 'DO-AUDIO-BYTES' && fakeCaches._stamps.get(sideKey('ext-morning-prayer', 'do')) === DO_MP
    && fakeCaches._store.get(sideKey('ext-morning-prayer', 'sth')) === 'STH-AUDIO-BYTES' && fakeCaches._stamps.get(sideKey('ext-morning-prayer', 'sth')) === STH_MP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { keys: [...fakeCaches._store.keys()].filter((k) => k.includes('morning')) });
  check('G10 ◆ Evening mirror of G1: one track, the Sing the Hours record whole with EVENING duration 869; the record\'s sides carry 880 (DO) / 869 (StH)',
    epD.length === 1 && epD[0].source === 'Sing the Hours' && epD[0].durationS === 869 && epD[0].imageUrl === STH_IMG
    && !!ep && ep.durationSec === 880 && !!ep.side2 && ep.side2.durationSec === 869,
    { n: epD.length, d: epD[0] && { durationS: epD[0].durationS } });
  w.close();
}
{
  // Fail-on-old by shape: the base client paints the single
  // choice-reordered record — no side2, no second track.
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJsOld, johnStore({}));
  await sleep(400);
  const O = w.__opn;
  drive(() => O.renderPrayersSide());
  await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present'; }, 15000);
  await sleep(500);
  const mp = slotOf(w, 'ext-morning-prayer');
  const mpD = descsOf(w, 'ext-morning-prayer');
  check('G1-old ◆ REPRODUCED on the base client: one choice-reordered record stands (no side2 side, no per-side keys) — the two-track emission does not exist',
    !!mp && !mp.side2 && mpD.length === 1, { side2: !!mp.side2, n: mpD.length });
  w.close();
}

// ---------- G2 ◆ 'Divine Office' ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'do' }));
  await sleep(400);
  const built = await buildDay(w);
  const mpD = descsOf(w, 'ext-morning-prayer');
  check('G2 ◆ setting \'do\': ONE Morning track — the Divine Office record whole (title · DO image · duration 1091), standing identity, blubrry side',
    built && mpD.length === 1 && mpD[0].source === 'Divine Office' && mpD[0].title === 'Morning Prayer - Divine Office' && mpD[0].imageUrl === DO_IMG && mpD[0].durationS === 1091 && !mpD[0]._side650,
    { n: mpD.length, d: mpD[0] && { source: mpD[0].source, durationS: mpD[0].durationS } });
  w.close();
}

// ---------- G3 ◆ 'Both': order, marks, draws (+ G9 engine hand-off, G10) ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'both' }));
  await sleep(400);
  const built = await buildDay(w);
  const O = w.__opn;
  const mpD = descsOf(w, 'ext-morning-prayer'), epD = descsOf(w, 'ext-evening-prayer');
  check('G3 ◆ setting \'both\': TWO Morning tracks, Sing the Hours first then Divine Office, each whole (durations 1034 / 1091, own images); the first takes the standing identity, the second carries _side650=\'do\'',
    built && mpD.length === 2 && mpD[0].source === 'Sing the Hours' && mpD[0].durationS === 1034 && !mpD[0]._side650
    && mpD[1].source === 'Divine Office' && mpD[1].durationS === 1091 && mpD[1]._side650 === 'do'
    && O.descCardKey(mpD[0]) === 'ext-morning-prayer' && O.descCardKey(mpD[1]) === 'ext-morning-prayer@do',
    { descs: mpD.map((d) => ({ source: d.source, side: d._side650 || null, ck: O.descCardKey(d) })) });
  check('G10 ◆ Evening mirror of G3: two tracks, StH (869) first then DO (880)',
    epD.length === 2 && epD[0].source === 'Sing the Hours' && epD[0].durationS === 869 && epD[1].source === 'Divine Office' && epD[1].durationS === 880,
    { descs: epD.map((d) => ({ source: d.source, durationS: d.durationS })) });
  const before = O.opnCounts615(mpD);
  drive(() => O.markCompleted(mpD[0]));
  await sleep(200);
  const after = O.opnCounts615(descsOf(w, 'ext-morning-prayer'));
  const now = descsOf(w, 'ext-morning-prayer');
  check('G3 ◆ playing the Sing the Hours track marks ONLY it: the Divine Office track still reads unplayed, the pair\'s unplayed count drops by exactly one, and each track draws its own intention key',
    before.unplayed === 2 && after.unplayed === 1
    && O.isPlayedDesc(now[0], CDATE) === true && O.isPlayedDesc(now[1], CDATE) === false
    && O.descMarkKey(now[0]) !== O.descMarkKey(now[1]) && O.trackKeyOf(now[0]) !== O.trackKeyOf(now[1]),
    { before, after, mk: now.map((d) => O.descMarkKey(d)) });
  const itemSth = drive(() => O.nativeContractItem(now[0]));
  const itemDo = drive(() => O.nativeContractItem(now[1]));
  check('G9 ◆ engine hand-off under \'both\': the StH descriptor\'s contract carries &src=Sing the Hours, the DO descriptor\'s &src=Divine Office — the descriptor\'s own source, not the slot record\'s standing source',
    !!itemSth && itemSth.mediaUri.includes('&src=Sing%20the%20Hours') && !!itemDo && itemDo.mediaUri.includes('&src=Divine%20Office'),
    { sth: itemSth && itemSth.mediaUri, do: itemDo && itemDo.mediaUri });
  w.close();
}

// ---------- G4 ◆ per-side bytes (restore world) ----------
async function restoreWorld(poison) {
  const store = await writtenCacheStore(appJs, { [CHOICE_KEY]: 'both' });
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const world = makeWorld(appJs, store);
  poison(world.fakeCaches);
  await sleep(400);
  const built = await buildDay(world.w);
  return { ...world, built };
}
{
  const { w, fakeCaches, mints, built } = await restoreWorld((fc) => {
    fc._store.set(sideKey('ext-morning-prayer', 'sth'), 'DO-AUDIO-BYTES'); // DO bytes under the StH side's key…
    fc._stamps.set(sideKey('ext-morning-prayer', 'sth'), DO_MP);           // …stamped with the DO enclosure
    fc._store.set(sideKey('ext-morning-prayer', 'do'), 'UNSTAMPED-DO-BYTES'); // unstamped entry under the DO side key
    fc._store.set(bareKey('ext-morning-prayer'), 'PRE-V650-BARE-BYTES');   // pre-v650 bare-key entry standing at first open
    fc._stamps.set(bareKey('ext-morning-prayer'), STH_MP);
  });
  await sleep(400);
  check('G4 ◆ a DO-stamped entry under the StH side key never mints under the StH track: the side re-downloads through pass-through&src=Sing the Hours and the side key lands StH bytes stamped with the StH enclosure',
    built && fakeCaches._store.get(sideKey('ext-morning-prayer', 'sth')) === 'STH-AUDIO-BYTES' && fakeCaches._stamps.get(sideKey('ext-morning-prayer', 'sth')) === STH_MP
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { bytes: fakeCaches._store.get(sideKey('ext-morning-prayer', 'sth')) });
  check('G4 ◆ an UNSTAMPED entry under a side key is a miss: the DO side re-downloads and re-stamps (DO bytes, DO enclosure stamp)',
    fakeCaches._store.get(sideKey('ext-morning-prayer', 'do')) === 'DO-AUDIO-BYTES' && fakeCaches._stamps.get(sideKey('ext-morning-prayer', 'do')) === DO_MP,
    { bytes: fakeCaches._store.get(sideKey('ext-morning-prayer', 'do')), stamp: fakeCaches._stamps.get(sideKey('ext-morning-prayer', 'do')) });
  check('G4 ◆ the pre-v650 bare-key entry is evicted on sight and never mints',
    !fakeCaches._store.has(bareKey('ext-morning-prayer')) && !mints.includes('PRE-V650-BARE-BYTES'),
    { bare: fakeCaches._store.get(bareKey('ext-morning-prayer')), mints: mints.slice(0, 6) });
  w.close();
}
{
  const { w, fakeCaches, mints, built } = await restoreWorld((fc) => {
    fc._store.set(sideKey('ext-morning-prayer', 'sth'), 'CACHED-STH-LAUDS-BYTES');
    fc._stamps.set(sideKey('ext-morning-prayer', 'sth'), STH_MP);
    fc._store.set(sideKey('ext-morning-prayer', 'do'), 'CACHED-DO-LAUDS-BYTES');
    fc._stamps.set(sideKey('ext-morning-prayer', 'do'), DO_MP);
    fc._store.set(sideKey('ext-evening-prayer', 'sth'), 'CACHED-STH-VESPERS-BYTES');
    fc._stamps.set(sideKey('ext-evening-prayer', 'sth'), STH_EP);
    fc._store.set(sideKey('ext-evening-prayer', 'do'), 'CACHED-DO-VESPERS-BYTES');
    fc._stamps.set(sideKey('ext-evening-prayer', 'do'), DO_EP);
  });
  await sleep(300);
  check('G4 ◆ stamped entries matching their side\'s enclosure restore untouched, per side: no audio fetch for either labeled slot, both cached byte strings mint',
    built && !FETCHLOG.some((u) => u.includes('externals/audio'))
    && fakeCaches._store.get(sideKey('ext-morning-prayer', 'sth')) === 'CACHED-STH-LAUDS-BYTES' && fakeCaches._store.get(sideKey('ext-morning-prayer', 'do')) === 'CACHED-DO-LAUDS-BYTES'
    && mints.includes('CACHED-STH-LAUDS-BYTES') && mints.includes('CACHED-DO-LAUDS-BYTES'),
    { pt: FETCHLOG.filter((u) => u.includes('externals/audio')), mints: mints.slice(0, 8) });
  w.close();
}

// ---------- G4b ◆ the prune, choice test removed (v637 leg, re-pointed) ----------
{
  // A cached labeled record missing its backup leaves and
  // re-settles (the whole-record test stands); a whole
  // record is untouched (proven by G4's restore leg: no
  // live fetch, no audio fetch).
  const store = await writtenCacheStore(appJs, { [CHOICE_KEY]: 'both' });
  const rec = JSON.parse(store['opn-ext-cache-v1']);
  delete rec.slots['ext-morning-prayer'].backup; // the record is no longer whole
  store['opn-ext-cache-v1'] = JSON.stringify(rec);
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, store);
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('G4b ◆ prune (choice test removed): a cached labeled record missing either side leaves and re-settles from the live payload — the slot stands whole again (standing side + side2 present) after a live fetch',
    built && !!mp && mp.state === 'present' && !!mp.side2 && mp.side2.state === 'present'
    && FETCHLOG.some((u) => u.includes('/api/player/externals/live')),
    { mp: mp && { state: mp.state, side2: !!mp.side2 }, live: FETCHLOG.filter((u) => u.includes('externals/live')).length });
  w.close();
}

// ---------- G4c ◆ the offline pass enumerates per side ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'both' }));
  await sleep(400);
  const built = await buildDay(w);
  const O = w.__opn;
  const items = drive(() => O.offlineEnumerateToday(CDATE).filter((it) => it.id === 'ext-morning-prayer'));
  check('G4c ◆ the offline pass enumerates ONE ITEM PER SIDE for a labeled slot, each under its own side key with its own enclosure (the reuse compare then binds per side)',
    built && items && items.length === 2
    && items.some((it) => it.key === sideKey('ext-morning-prayer', 'do') && it.enclosureUrl === DO_MP)
    && items.some((it) => it.key === sideKey('ext-morning-prayer', 'sth') && it.enclosureUrl === STH_MP),
    { items: items && items.map((it) => ({ key: it.key, enclosureUrl: it.enclosureUrl })) });
  w.close();
}

// ---------- G5 ◆ in-session re-paint through the drop down ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'sth' }));
  await sleep(400);
  const built = await buildDay(w);
  const O = w.__opn;
  const dayBefore = O.state.dayPayload;
  const entered = await enterEdit(w);
  const sel = w.document.querySelector('[data-p650office]');
  check('G5 ◆ setup: the Edit form paints the drop down standing at \'Sing the Hours\', one Morning track before the change',
    built && entered && !!sel && sel.value === 'sth' && descsOf(w, 'ext-morning-prayer').length === 1,
    { entered, sel: sel && sel.value, n: descsOf(w, 'ext-morning-prayer').length });
  const liveBefore = FETCHLOG.filter((u) => u.includes('/api/player/externals/live')).length;
  const setChoice = async (v) => {
    const s = w.document.querySelector('[data-p650office]');
    if (!s) return false;
    s.value = v;
    s.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(400);
    return true;
  };
  await setChoice('both');
  const bothD = descsOf(w, 'ext-morning-prayer');
  const bothOk = bothD.length === 2 && bothD[0].source === 'Sing the Hours' && bothD[1].source === 'Divine Office';
  await setChoice('do');
  const doD = descsOf(w, 'ext-morning-prayer');
  const liveAfter = FETCHLOG.filter((u) => u.includes('/api/player/externals/live')).length;
  check('G5 ◆ drop down \'Sing the Hours\' → \'Both\' → \'Divine Office\' re-paints in-session: track sets 1 → 2 → 1 in the directed order, ZERO live-payload fetches, the day payload object unmoved (paint change only)',
    bothOk && doD.length === 1 && doD[0].source === 'Divine Office'
    && liveAfter === liveBefore && O.state.dayPayload === dayBefore && w.localStorage.getItem(CHOICE_KEY) === 'do',
    { both: bothD.map((d) => d.source), do: doD.map((d) => d.source), liveBefore, liveAfter });
  w.close();
}

// ---------- G6 ◆ a side missing paints the standing side alone ----------
{
  LIVE_NOW = LIVE_NOBACKUP; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'sth' }));
  await sleep(400);
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present'; }, 15000);
  await sleep(400);
  const seq = [];
  for (const v of ['sth', 'do', 'both']) {
    drive(() => { O.opnOfficeChoiceSet650(v); O.extRebuildDescs(O.state.dayPayload); });
    await sleep(150);
    const d = descsOf(w, 'ext-morning-prayer');
    seq.push(d.length === 1 && d[0].source === 'Divine Office' && d[0].available);
  }
  check('G6 ◆ no backup in the payload (Sing the Hours missing): the Divine Office track paints ALONE under every setting, including \'Sing the Hours\' — no placeholder for the missing side',
    built && seq.every(Boolean), { seq });
  w.close();
}
{
  LIVE_NOW = LIVE_STH_ONLY; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'do' }));
  await sleep(400);
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present'; }, 15000);
  await sleep(400);
  const seq = [];
  for (const v of ['do', 'sth', 'both']) {
    drive(() => { O.opnOfficeChoiceSet650(v); O.extRebuildDescs(O.state.dayPayload); });
    await sleep(150);
    const d = descsOf(w, 'ext-morning-prayer');
    seq.push(d.length === 1 && d[0].source === 'Sing the Hours' && d[0].available);
  }
  check('G6 ◆ mirror (Divine Office unresolved, Sing the Hours standing as the served record): the Sing the Hours track paints alone under every setting',
    built && seq.every(Boolean), { seq });
  w.close();
}

// ---------- G7 ◆ migration ----------
{
  const mig = async (extra) => {
    const { w } = makeWorld(appJs, johnStore(extra));
    await sleep(250);
    const v = drive(() => w.__opn.opnOfficeChoice650());
    const stored = w.localStorage.getItem(CHOICE_KEY);
    w.close();
    return { v, stored };
  };
  const a = await mig({ [STH_KEY]: 'on' });
  const b = await mig({ [STH_KEY]: 'off' });
  const c = await mig({ [PIN_KEY]: JSON.stringify({ saltHex: 'ab12', hashHex: 'cd34', iterations: 210000, sthPrimary: true, biometricPref: false }) });
  const d = await mig({});
  check('G7 ◆ migration: old key \'on\' → \'sth\' · \'off\' → \'do\' · PIN record sthPrimary true → \'sth\' · nothing anywhere → \'sth\' (default); the new store is written in each case',
    a.v === 'sth' && a.stored === 'sth' && b.v === 'do' && b.stored === 'do' && c.v === 'sth' && c.stored === 'sth' && d.v === 'sth' && d.stored === 'sth',
    { a, b, c, d });
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(250);
  const first = drive(() => w.__opn.opnOfficeChoice650());
  w.localStorage.setItem(STH_KEY, 'off'); // a later old-key change…
  const second = drive(() => w.__opn.opnOfficeChoice650());
  check('G7 ◆ the migration writes once: a later old-key change moves nothing',
    first === 'sth' && second === 'sth' && w.localStorage.getItem(CHOICE_KEY) === 'sth', { first, second });
  w.close();
}

// ---------- G8 ◆ contents duplicate × 'Both' ----------
{
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [CHOICE_KEY]: 'both' }));
  await sleep(400);
  const built = await buildDay(w);
  const O = w.__opn;
  const day = O.state.dayPayload;
  const day2 = JSON.parse(JSON.stringify(day));
  day2.profile = Object.assign({}, day.profile || {}, { contents: { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-morning-prayer' }] } });
  drive(() => O.extRebuildDescs(day2));
  await sleep(200);
  const mps = (O.state.dayDescs || []).filter((d) => d.episodeId === 'ext-morning-prayer');
  const cardKeys = mps.map((d) => O.descCardKey(d));
  const markKeys = mps.map((d) => O.descMarkKey(d));
  check('G8 ◆ a contents list holding the Morning Prayer selector twice paints, per occurrence, the standing sides in order — four tracks, each with its own card key and mark key',
    built && mps.length === 4
    && mps.map((d) => d.source).join('|') === 'Sing the Hours|Divine Office|Sing the Hours|Divine Office'
    && new Set(cardKeys).size === 4 && new Set(markKeys).size === 4
    && cardKeys[1] === 'ext-morning-prayer@do' && cardKeys[2] === 'ext-morning-prayer#1' && cardKeys[3] === 'ext-morning-prayer#1@do',
    { n: mps.length, cardKeys, markKeys });
  w.close();
}

console.log('\nharness-v650:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
