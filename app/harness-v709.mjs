// harness-v709.mjs — v709: leaving and re-selecting the
//  Office of Readings the same day resumes at the saved
//  position, under the v680 rules whole.
// Modeled on harness-v680 (the standing two-world recipe:
//  the real client driven in a DOM world; the native world
//  drives a bridge stub capturing setNativeQueue contracts
//  and publishes engine state through applyNativeState).
//
// §2.2 EVIDENCE (Implement read-backs, 2026-11-28, §3 of the
//  release doc): every duration source CLEARED — the stored
//  production resolution for the field day carries
//  durationSec 1173 = the feed's 19:33 — so the §2.1
//  PRIMARY seat (cross95 duration input) does NOT stand and
//  this harness proves the §2.1 FALLBACK seat: the tap-time
//  day branch and queueMarkPos617 read through ONE reader
//  (dayStoredPos709) — the payload fold first, else the
//  opn-daypos-pending-v1 slot entry for (episodeId,
//  presented date), which no tap-time read consulted before.
//
// THE FIELD CONDITION the legs construct (from the §2.2
//  read-backs, not invented): for the field day 2026-11-27
//  NO day_positions row stands in production for
//  ext-office-of-readings (nor in either position store
//  after 2026-11-20) — so a day refetch rebuilds the fold
//  WITHOUT the saved position, while the save's local leg
//  (the pending slot entry, standing whenever its post has
//  not landed) still holds it. simulateFieldRefetch()
//  constructs exactly that divergence: fold emptied (the
//  rebuilt payload), slot entry standing (the save's own
//  synchronous local write, captured verbatim in L1).
//
// Fixture (Improvement D — production sources, named):
//  - The REAL production resolution records for 2026-11-27,
//    read from the production D1 ext_resolutions table via
//    the Cloudflare connector at Implement time
//    (2026-11-28): ext-office-of-readings — title
//    "Office of Readings – Divine Office: Liturgy of the
//    Hours", stream_url …/divine-ord-w34-fri-or.mp3?…,
//    duration_s 1173, size_bytes 25162812, source NULL,
//    resolved_at 2026-11-27T06:00:46.427Z — and
//    ext-morning-prayer — duration_s 1043, size_bytes
//    22549217, source "Divine Office", resolved_at
//    2026-11-27T06:00:46.114Z. Seated into the harness
//    world's slot state verbatim, exactly as the courier
//    payload seats them (extSlotTrack's inputs).
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the v597 production
//    day (the standing day-fixture family, as harness-v680);
//    its real own-track episodeId 'morning-prayer' carries
//    the L6 own-track leg. John's real profile data, as
//    harness-v680 uses it.
// Fail-on-old pin: the Plan base ff0b30b (the v706 tree).
//  OA-L1 and OA-L2 MUST fail there (the tap-time reads
//  consult the fold only — the field defect, standing).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', 'ff0b30b:app/worker/src/client.ts']); // fail-on-old pin: the Plan base (v706 tree)
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'))));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const OOR = 'ext-office-of-readings', MP = 'ext-morning-prayer';
// The real 2026-11-27 production resolution records (above).
const REC_OOR = { state: 'present', title: 'Office of Readings \u2013 Divine Office: Liturgy of the Hours', source: null, streamUrl: 'https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ord-w34-fri-or.mp3?prayer=OfficeOfReadings&date=20261127&episode=202611273', durationSec: 1173, sizeBytes: 25162812 };
const REC_MP = { state: 'present', title: 'Morning Prayer \u2013 Divine Office: Liturgy of the Hours', source: 'Divine Office', streamUrl: 'https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ord-w02-fri-mp.mp3?prayer=MorningPrayer&date=20261127&episode=202611274', durationSec: 1043, sizeBytes: 22549217 };

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
check('T0b the v709 seats stand in the client: dayStoredPos709 (fold first, pending-slot fallback), both tap-time call sites read through it, the 95% rule byte-standing (ceil(dur*0.95) + markCompleted), and the pin is ora-pro-nobis-v709-1',
  clientSrc.includes('function dayStoredPos709(episodeId)')
  && clientSrc.includes('var fold617 = dayStoredPos709(desc.episodeId);')
  && clientSrc.includes('var dayPos = dayStoredPos709(desc.episodeId);')
  && clientSrc.includes('live.pos < Math.ceil(dur * 0.95)')
  && clientSrc.includes('markCompleted(cur);')
  && uiSrc.includes('var CACHE = "ora-pro-nobis-v709-1";'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v709:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, opnPlayback, markCompleted, writePlayed, isPlayedDesc, applyNativeState, nativeContractFor, startDesc, startQueue, oraNativeMode, playPos, nativeMirrorTick, readQueueSnapshot, queueMarkPos617, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
function nativeBridge() {
  const cap = { queues: [], transports: [] };
  const plugin = {
    setNativeQueue: (arg) => { cap.queues.push(JSON.parse(arg.queue)); return Promise.resolve({}); },
    nativeTransport: (arg) => { cap.transports.push(JSON.parse(arg.command)); return Promise.resolve({}); },
    addListener: () => Promise.resolve({ remove: () => {} }),
  };
  return { plugin, cap };
}
function dumpStore(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}
function kill(w) { const store = dumpStore(w); w.close(); return store; }
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
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
  // The fixture: the real 2026-11-27 production records,
  // verbatim, seated exactly as the courier payload seats
  // them (the harness-v680 buildStanding shape, real values).
  O.state.extSlots[OOR] = Object.assign({}, REC_OOR);
  O.state.extSlots[MP] = Object.assign({}, REC_MP);
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
const byId = (descs, id) => (descs || []).find((d) => d.episodeId === id);
function publisher(O, dur) {
  let ts = Date.now();
  return (trackId, queueIndex, positionS, playing) => O.applyNativeState(JSON.stringify({
    engine: 'native', trackId, queueIndex, positionS, durationS: dur, playing: !!playing, rate: 1, ts: ++ts,
  }));
}
const within = (v, target, tol) => v !== null && v !== undefined && Math.abs(v - target) <= tol;
function slotEntry(w, epId) {
  try { const m = JSON.parse(w.localStorage.getItem('opn-daypos-pending-v1') || '{}'); return m[epId + '|' + DATE] || null; } catch (e) { return null; }
}
// THE FIELD CONDITION (header): a day refetch rebuilds the
// fold from a server payload whose day_positions row does
// not stand — the fold loses the episode — while the save's
// pending-slot entry (its post not landed) still holds it.
function simulateFieldRefetch(w, epId, positionS, durationS) {
  const O = w.__opn;
  if (O.state.dayPayload && O.state.dayPayload.dayPositions) O.state.dayPayload.dayPositions = {};
  const m = {};
  m[epId + '|' + DATE] = { positionS, durationS };
  try { w.localStorage.setItem('opn-daypos-pending-v1', JSON.stringify(m)); } catch (e) {}
}

// ---------- L1 ◆ THE field leg, native (fallback form) ----------
// Start the Office of Readings from the real fixture record,
// play to a true mid position (600 of the truthful 1173),
// switch to another track, let the fold lose the position
// (the field condition), fresh-compose, re-select.
async function l1World(js) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const oor = byId(descs, OOR), mp = byId(descs, MP);
  drive(() => O.startDesc(oor));
  await sleep(80);
  const pub = publisher(O, REC_OOR.durationSec);
  pub(OOR, 0, 0, true);
  await sleep(30);
  pub(OOR, 0, 600, true);
  await sleep(30);
  O.nativeMirrorTick();
  // The slot assertion reads SYNCHRONOUSLY at the tick: the
  // save's local leg holds the newest value before the
  // post's answer can land (the harness-v680 K2 posture).
  const slotAtTick = slotEntry(w, OOR);
  O.nativeMirrorTick();
  await sleep(150);
  drive(() => O.startDesc(mp)); // switch away — the skip-away save fires
  await sleep(120);
  simulateFieldRefetch(w, OOR, 600, REC_OOR.durationSec);
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  const oor2 = byId(descs2, OOR);
  const qmark = drive(() => O.queueMarkPos617(oor2));
  drive(() => O.startDesc(oor2)); // the re-select
  await sleep(80);
  const contract = cap.queues[cap.queues.length - 1];
  return { w, slotAtTick, qmark, played: drive(() => O.isPlayedDesc(oor2, DATE)), startPos: contract ? contract.startPositionS : null };
}
{
  const r = await l1World(appJs);
  check('L1 ◆ field leg (native): the mirror tick\u2019s save held 600 in the pending slot at the write instant (the save\u2019s guaranteed-local leg)',
    !!r.slotAtTick && r.slotAtTick.positionS === 600 && r.slotAtTick.durationS === 1173, { slotAtTick: r.slotAtTick });
  check('L1 ◆ field leg (native): after the fold loses the position and a fresh compose re-selects the Office of Readings, the contract resumes at the saved position (startPositionS ≈600 ±6)',
    within(r.startPos, 600, 6), { startPos: r.startPos });
  check('L1 ◆ field leg (native): the track does NOT stand read after the mid-play switch-away and return',
    r.played === false, { played: r.played });
  check('L1b ◆ queue transitions read through the same reader: queueMarkPos617 returns the slot-held 600 when the fold carries nothing',
    r.qmark === 600, { qmark: r.qmark });
  r.w.close();
}

// ---------- L2 ◆ web twin of L1 ----------
async function l2World(js) {
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const oor = byId(descs, OOR), mp = byId(descs, MP);
  drive(() => O.startDesc(oor));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: REC_OOR.durationSec, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 600; // a true mid position (600 of 1173)
  audio.dispatchEvent(new w.Event('timeupdate')); // the 5 s cadence tick fires the save
  await sleep(150);
  drive(() => O.startDesc(mp)); // switch away
  await sleep(120);
  simulateFieldRefetch(w, OOR, 600, REC_OOR.durationSec);
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  const oor2 = byId(descs2, OOR);
  O.state.pendingResume = null;
  drive(() => O.startDesc(oor2)); // the re-select
  await sleep(80);
  return { w, pending: O.state.pendingResume && O.state.pendingResume.positionS };
}
{
  const r = await l2World(appJs);
  check('L2 ◆ web twin of L1: the element path resumes at the saved position after the fold loss (pendingResume ≈600 ±6)',
    within(r.pending, 600, 6), { pending: r.pending });
  r.w.close();
}

// ---------- L3 ◆ under-5 s leg (the v680 rule, unchanged) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const oor = byId(descs, OOR), mp = byId(descs, MP);
  drive(() => O.startDesc(oor));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: REC_OOR.durationSec, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 3;
  audio.dispatchEvent(new w.Event('timeupdate'));
  await sleep(150);
  drive(() => O.startDesc(mp));
  await sleep(120);
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  const oor2 = byId(descs2, OOR);
  O.state.pendingResume = null;
  drive(() => O.startDesc(oor2));
  await sleep(80);
  const foldPos = O.state.dayPayload && O.state.dayPayload.dayPositions ? O.state.dayPayload.dayPositions[OOR] : null;
  check('L3 ◆ under-5 s: playing the fixture track to 3 s writes no position in any store (fold · slot), and the re-select starts at the top (no pendingResume)',
    !O.state.pendingResume && (foldPos === null || foldPos === undefined) && slotEntry(w, OOR) === null,
    { pendingResume: O.state.pendingResume, foldPos, slot: slotEntry(w, OOR) });
  w.close();
}

// ---------- L4 ◆ 95% leg, truthful engine duration (the rule still fires) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const oor = byId(descs, OOR);
  drive(() => O.startDesc(oor));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: REC_OOR.durationSec, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 1150; // past 95% of the engine-measured 1173 (ceil = 1115)
  audio.dispatchEvent(new w.Event('timeupdate'));
  await sleep(200);
  const played = drive(() => O.isPlayedDesc(oor, DATE));
  const foldPos = O.state.dayPayload && O.state.dayPayload.dayPositions ? O.state.dayPayload.dayPositions[OOR] : null;
  const slot = slotEntry(w, OOR);
  // Switch away first (the field flow): a re-start of the
  // still-current track would take the v617 live carry,
  // which is a live position, not a store read.
  const mp = byId(descs, MP);
  drive(() => O.startDesc(mp));
  await sleep(120);
  O.state.pendingResume = null;
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  drive(() => O.startDesc(byId(descs2, OOR)));
  await sleep(80);
  check('L4 ◆ 95% with a truthful engine duration: crossing marks the track READ (the v680 §2.9 rule firing exactly as prescribed — the fix did not blunt it)',
    played === true, { played });
  check('L4 ◆ the crossing cleared the position in the fold AND the slot, and a fresh tap starts at the top (no pendingResume — the slot fallback never resurrects a cleared track)',
    (foldPos === null || foldPos === undefined) && slot === null && !O.state.pendingResume,
    { foldPos, slot, pendingResume: O.state.pendingResume });
  w.close();
}

// ---------- L5 ◆ kill leg (v680/v681 regression-in-miniature) ----------
{
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const oor = byId(descs, OOR);
  drive(() => O.startDesc(oor));
  await sleep(80);
  const pub = publisher(O, REC_OOR.durationSec);
  pub(OOR, 0, 0, true);
  await sleep(30);
  pub(OOR, 0, 600, true);
  await sleep(30);
  O.nativeMirrorTick(); O.nativeMirrorTick();
  await sleep(150);
  const store = kill(w); // hard kill: no lifecycle event of any kind
  const b2 = nativeBridge();
  const w2 = makeWorld(appJs, store, b2.plugin);
  await sleep(400);
  const O2 = w2.__opn;
  const r2 = await paintRealDay(w2);
  // The server fold seat (index.ts day payload), stubbed as
  // harness-v680 stubbed it: the reopened fold is built from
  // what the writes actually landed in the store.
  const landed = O2.opnPlayback().dayPositions[OOR + '|' + DATE];
  if (landed) O2.state.dayPayload.dayPositions = { [OOR]: landed.positionS };
  const descs2 = O2.extRebuildDescs(O2.state.dayPayload) || [];
  const oor2 = byId(descs2, OOR) || byId(r2.descs, OOR);
  drive(() => O2.startDesc(oor2));
  await sleep(80);
  const contract = b2.cap.queues[b2.cap.queues.length - 1];
  check('L5 ◆ kill leg: mid position (600), hard kill, reboot over the same storage — the re-select resumes within ±6 of 600',
    !!contract && within(contract.startPositionS, 600, 6), { startPos: contract && contract.startPositionS, landed });
  w2.close();
}

// ---------- L6 ◆ class sample: Morning Prayer (real record) + one own track ----------
async function l6MpWorld(js) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const mp = byId(descs, MP), oor = byId(descs, OOR);
  drive(() => O.startDesc(mp));
  await sleep(80);
  const pub = publisher(O, REC_MP.durationSec);
  pub(MP, 0, 0, true);
  await sleep(30);
  pub(MP, 0, 500, true); // mid position (500 of the truthful 1043)
  await sleep(30);
  O.nativeMirrorTick(); O.nativeMirrorTick();
  await sleep(150);
  drive(() => O.startDesc(oor)); // switch away
  await sleep(120);
  simulateFieldRefetch(w, MP, 500, REC_MP.durationSec);
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  const mp2 = byId(descs2, MP);
  drive(() => O.startDesc(mp2));
  await sleep(80);
  const contract = cap.queues[cap.queues.length - 1];
  return { w, startPos: contract ? contract.startPositionS : null };
}
{
  const r = await l6MpWorld(appJs);
  check('L6 ◆ class sample, Morning Prayer (its real 2026-11-27 record, 1043 s): the same fold-loss flow resumes at the saved position (startPositionS ≈500 ±6)',
    within(r.startPos, 500, 6), { startPos: r.startPos });
  r.w.close();
}
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const own = byId(descs, 'morning-prayer'), ext = byId(descs, OOR);
  drive(() => O.startDesc(own));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: 300, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 200;
  audio.dispatchEvent(new w.Event('timeupdate'));
  await sleep(150);
  drive(() => O.startDesc(ext)); // switch away
  await sleep(120);
  simulateFieldRefetch(w, 'morning-prayer', 200, 300);
  const descs2 = O.extRebuildDescs(O.state.dayPayload) || [];
  const own2 = byId(descs2, 'morning-prayer');
  O.state.pendingResume = null;
  drive(() => O.startDesc(own2));
  await sleep(80);
  check('L6 ◆ class sample, one own track (\u2019morning-prayer\u2019, the v597 day\u2019s real own episode): the same fold-loss flow resumes at the saved position (pendingResume ≈200 ±6)',
    !!O.state.pendingResume && within(O.state.pendingResume.positionS, 200, 6), { pendingResume: O.state.pendingResume });
  w.close();
}

// ---------- OA ◆ fail-on-old (the Plan base tree, ff0b30b) ----------
{
  const r = await l1World(oldJs);
  check('OA-L1 ◆ fail-on-old: on the base tree the tap-time reads consult the fold only — after the fold loss the re-select starts at 0 and queueMarkPos617 reads 0 (the field defect, standing)',
    (r.startPos === 0 || r.startPos === null) && (r.qmark === 0 || r.qmark === null), { startPos: r.startPos, qmark: r.qmark });
  r.w.close();
}
{
  const r = await l2World(oldJs);
  check('OA-L2 ◆ fail-on-old: on the base tree the web twin also starts at the top after the fold loss (no pendingResume)',
    !r.pending, { pending: r.pending });
  r.w.close();
}

console.log('harness-v709:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
