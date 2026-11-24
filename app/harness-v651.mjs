// harness-v651.mjs — v651 §4 leg L1: the client hand-off
//  stands whole (REGRESSION GUARD — passes on the v650 base
//  client too, because §3 changes no client code: the fix is
//  shell-only, in the Android repo's native offline store).
//   L1a Morning: oraDaySnapshot under 'Both' emits TWO items
//     for ext-morning-prayer with the SAME id and mediaUris
//     differing only in &src= (Sing the Hours first — paint
//     order — then Divine Office), each naming its own
//     descriptor's source; durations 1034 / 1091.
//   L1b Evening mirror: ext-evening-prayer, 869 / 880.
//   L1c descriptors + contract: the day descriptors carry
//     per-side source / url / _side650 through the paint
//     (first = standing identity, second _side650='do'), and
//     nativeContractFor over the standing queue keeps items
//     and descriptors positionally parallel — both labeled
//     items present, same id, per-side mediaUri.
//   L1d the guard on the BASE client (daee990, the v650 ship
//     tree): L1a/L1b pass unchanged — the hand-off was never
//     the defect; the losing hop is the shell's id-only file
//     key (held by the android repo's N1-N7 legs).
//   L1e §3.5 proof: client.ts in this tree is byte-identical
//     to the base (git diff empty) — no client change ships.
//
// Fixture (Improvement D — production source, named): the
//  REAL 2026-11-24 live payload shape, as grounded at v650
//  §2.6 / v651 §2.6 — standing Divine Office whole (blubrry
//  stream · DO logo · durationSec Morning 1091 / Evening
//  880) with a whole Sing the Hours backup (castos stream ·
//  StH image · Morning 1034 / Evening 869).
//
// Scaffold: harness-v650.mjs's world (jsdom boot, fetch and
//  Cache Storage stubs, the day build), trimmed to L1.
//
// Run: node app/harness-v651.mjs
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
const BASE = git(['rev-parse', 'daee990']).trim(); // v651 base = v650 ship tree (client unchanged by §3)
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
const HOOK = '\n;window.__opn = { state, opn604, audioEl, opnFoldDay590, paintPrayersView, extRebuildDescs, renderPrayersSide, nativeContractItem, nativeContractFor, oraDaySnapshot, offlineDownloadItemsCache, offlineEnumerateToday, descMarkKey, descCardKey, isPlayedDesc, markCompleted, opnCounts615, trackKeyOf,'
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


// ---------- L1 ◆ the hand-off stands whole ----------
const stripSrc = (u) => u.replace(/&src=[^&]*/, '');
const srcOf = (u) => { const m = /&src=([^&]*)/.exec(u); return m ? decodeURIComponent(m[1]) : null; };
async function l1World(js) {
  LIVE_NOW = LIVE650; FETCHLOG = [];
  const world = makeWorld(js, johnStore({ [CHOICE_KEY]: 'both' }));
  await sleep(400);
  const built = await buildDay(world.w);
  return { ...world, built };
}
function l1Checks(tag, w, built) {
  const O = w.__opn;
  const snap = drive(() => O.oraDaySnapshot());
  const tracks = (snap && snap.tracks) || [];
  const mp = tracks.filter((t) => t.id === 'ext-morning-prayer');
  const ep = tracks.filter((t) => t.id === 'ext-evening-prayer');
  check(tag + ' L1a ◆ Morning snapshot: TWO items, SAME id, mediaUris differing ONLY in &src= — Sing the Hours first (1034), Divine Office second (1091), each naming its own source',
    built && mp.length === 2 && mp[0].id === mp[1].id
    && srcOf(mp[0].mediaUri) === 'Sing the Hours' && srcOf(mp[1].mediaUri) === 'Divine Office'
    && stripSrc(mp[0].mediaUri) === stripSrc(mp[1].mediaUri)
    && mp[0].durationS === 1034 && mp[1].durationS === 1091
    && mp[0].title.includes('Sing the Hours') && mp[1].title.includes('Divine Office'),
    { mp: mp.map((t) => ({ src: srcOf(t.mediaUri), durationS: t.durationS, title: t.title })) });
  check(tag + ' L1b ◆ Evening mirror: two items, same id, &src= per side, durations 869 / 880',
    ep.length === 2 && ep[0].id === ep[1].id
    && srcOf(ep[0].mediaUri) === 'Sing the Hours' && srcOf(ep[1].mediaUri) === 'Divine Office'
    && stripSrc(ep[0].mediaUri) === stripSrc(ep[1].mediaUri)
    && ep[0].durationS === 869 && ep[1].durationS === 880,
    { ep: ep.map((t) => ({ src: srcOf(t.mediaUri), durationS: t.durationS })) });
  return { snap, mp, ep };
}
{
  const { w, built } = await l1World(appJs);
  const O = w.__opn;
  l1Checks('new', w, built);
  const mpD = descsOf(w, 'ext-morning-prayer');
  check('new L1c ◆ descriptors carry the sides through the paint: per-side source + url, first takes the standing identity, second carries _side650=\'do\'; nativeContractFor keeps items ∥ descriptors (both labeled items, same id, per-side mediaUri)',
    mpD.length === 2 && mpD[0].source === 'Sing the Hours' && mpD[1].source === 'Divine Office'
    && !!mpD[0].url && !!mpD[1].url && mpD[0].url !== mpD[1].url
    && !mpD[0]._side650 && mpD[1]._side650 === 'do',
    { descs: mpD.map((d) => ({ source: d.source, side: d._side650 || null })) });
  const q = (O.state.dayDescs || []).slice();
  O.state.queue = q; O.state.queueIdx = Math.max(0, q.indexOf(mpD[0]));
  const cf = drive(() => O.nativeContractFor(mpD[0]));
  const cItems = (cf && cf.contract && cf.contract.items) || [];
  const cMp = cItems.filter((it) => it.id === 'ext-morning-prayer');
  check('new L1c ◆ the contract for the standing queue carries both Morning items positionally parallel to their descriptors, mediaUri per side',
    !!cf && cf.descs.length === cItems.length && cMp.length === 2
    && srcOf(cMp[0].mediaUri) === 'Sing the Hours' && srcOf(cMp[1].mediaUri) === 'Divine Office'
    && cf.descs[cItems.indexOf(cMp[0])].source === 'Sing the Hours'
    && cf.descs[cItems.indexOf(cMp[1])].source === 'Divine Office',
    { n: cItems.length, cMp: cMp.map((it) => srcOf(it.mediaUri)) });
  w.close();
}
{
  // The guard on the base client: the hand-off was already
  // whole at v650 — L1 passes there by design (§2.2).
  const { w, built } = await l1World(appJsOld);
  l1Checks('old', w, built);
  w.close();
}
{
  const diff = git(['diff', '--stat', BASE, '--', 'app/worker/src/client.ts']).trim();
  check('L1e ◆ §3.5 proof: client.ts is byte-identical to the v650 base (no client change in this release)',
    diff === '', { diff });
}
console.log('harness-v651:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
