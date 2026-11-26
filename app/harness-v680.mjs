// harness-v680.mjs — v680: a partly played episode resumes
//  where it stopped, even after the app is killed; plus the
//  §2.9 leg: a track that crosses 95% of its duration stands
//  READ at that moment and its position clears.
// Modeled on harness-v617 (the standing two-world recipe:
//  the real client driven in a DOM world; the native world
//  drives a bridge stub capturing setNativeQueue contracts
//  and publishes engine state through applyNativeState).
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v515/series-bible-in-a-year-live-2026-11-17.json
//    — the production Bible in a Year series payload; its
//    Day 1 entry (biy:day-1, durationS 1248) and Day 2
//    (biy:day-2, 1441) are the podcast legs' episodes,
//    resolved through the client's own v614 contents-pin
//    path (a Salesian Morning contents pin), exactly as a
//    Praylist/episode-page descriptor is built.
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the v597 production
//    day; its real episodeIds ('morning-prayer',
//    'ext-morning-prayer') carry the day legs.
// KILL simulation (the leg that matters): the world is torn
//  down by dumping localStorage and closing the window —
//  NO pause, stop, ended, visibilitychange or pagehide is
//  dispatched — and a FRESH client context boots over the
//  dumped store. In the public shape the position stores
//  are the on-device core/playback stores (localStorage),
//  which is the kill-surviving store family the Plan names.
// Fail-on-old pin: the v679 tree, base 43eb549. K1, K3(b),
//  K2's day-slot assertion and M2 MUST fail there.
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
const oldClientSrc = git(['show', '43eb549:app/worker/src/client.ts']); // fail-on-old pin: the v679 tree
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE515 = JSON.parse(readFileSync(APP + 'tests/fixtures-v515/series-bible-in-a-year-live-2026-11-17.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const EP1 = 'biy:day-1', EP2 = 'biy:day-2', SERIES = 'bible-in-a-year';
const COREKEY = SERIES + '|' + EP1;

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
check('T0b the v680 seats stand in the client: livePos680, the day slot (opn-daypos-pending-v1 + drainDayPositions), crossed95 + markCompleted in the tick family, the nativeMirrorTick periodic leg, and the applyNativeState step-5 saves',
  clientSrc.includes('function livePos680(track)')
  && clientSrc.includes("var DAYPOS_KEY = 'opn-daypos-pending-v1'")
  && clientSrc.includes('function drainDayPositions()')
  && clientSrc.includes('var crossed95 = {}')
  && clientSrc.includes('markCompleted(cur);')
  && clientSrc.includes('if (nativeMirror.playing && state.current && nativeMirror.trackId === state.current.episodeId) { podPositionTick(); dayPositionTick(); }')
  && clientSrc.includes('saveTrackPos680(state.current, stopPos680, prevMirror680.durationS || 0)'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v680:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveProfileEpisodes614, opnPodCoreSetPosition, opnPodCore, opnPlayback, markCompleted, writePlayed, applyNativeState, nativeContractFor, startQueue, advanceQueue, startDesc, oraNativeMode, playPos, nativeMirrorTick, tryStandPodcastRestore, readQueueSnapshot, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = JSON.parse(JSON.stringify(BIBLE515));
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
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
// THE KILL: dump the storage, close the window. No lifecycle
// event of any kind is dispatched — process death, exactly.
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
function johnWithPins(keys) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: keys.map((k) => ({ kind: 'episode', key: SERIES + '|' + k })) });
  return doc;
}
async function resolveEp(w, epKey) {
  const O = w.__opn;
  O.resolveProfileEpisodes614(O.state.dayPayload);
  const end = Date.now() + 8000;
  while (Date.now() < end && !(O.state.episodeRes614 && O.state.episodeRes614['Morning:' + SERIES + '|' + epKey])) await sleep(100);
  await sleep(120);
  return O.state.episodeRes614 && O.state.episodeRes614['Morning:' + SERIES + '|' + epKey];
}
function publisher(O, dur) {
  let ts = Date.now();
  return (trackId, queueIndex, positionS, playing) => O.applyNativeState(JSON.stringify({
    engine: 'native', trackId, queueIndex, positionS, durationS: dur, playing: !!playing, rate: 1, ts: ++ts,
  }));
}
const corePos = (w, key) => { const c = w.__opn.opnPodCore(); return c.positions[key] ? c.positions[key].positionS : null; };
const coreListened = (w, key) => !!w.__opn.opnPodCore().listens[key];
const within = (v, target, tol) => v !== null && v !== undefined && Math.abs(v - target) <= tol;

// ---------- K1 ◆ native kill, single play (THE field leg) ----------
async function k1World(js) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) }, plugin);
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const pod = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod));
  await sleep(80);
  const pub = publisher(O, 1248);
  pub(EP1, 0, 0, true);
  await sleep(30);
  pub(EP1, 0, 600, true); // mid-episode (600 of 1248)
  await sleep(30);
  O.nativeMirrorTick(); O.nativeMirrorTick(); // two 5 s mirror ticks run
  await sleep(120);
  const storeAtKill = corePos(w, COREKEY);
  const store = kill(w);
  // Reboot: fresh context over the same storage.
  const b2 = nativeBridge();
  const w2 = makeWorld(js, store, b2.plugin);
  await sleep(400);
  const O2 = w2.__opn;
  await paintRealDay(w2);
  const pod2 = await resolveEp(w2, EP1);
  drive(() => O2.startDesc(pod2));
  await sleep(80);
  const contract = b2.cap.queues[b2.cap.queues.length - 1];
  return { w2, storeAtKill, pod2, startPos: contract ? contract.startPositionS : null };
}
{
  const r = await k1World(appJs);
  check('K1 ◆ native kill, single play: the periodic mirror write landed the position in the kill-surviving store during playback (core position ≈600 at kill)',
    within(r.storeAtKill, 600, 6), { storeAtKill: r.storeAtKill });
  check('K1 ◆ after the kill, the refetched descriptor carries the position and the tap start carries it (contract startPositionS ≈600 ±6)',
    !!r.pod2 && within(r.pod2.podPositionS, 600, 6) && within(r.startPos, 600, 6),
    { podPositionS: r.pod2 && r.pod2.podPositionS, startPos: r.startPos });
  r.w2.close();
}

// ---------- K3 ◆ native kill, QUEUE play ----------
async function k3World(js, doRestore) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1, EP2])) }, plugin);
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const p1 = await resolveEp(w, EP1);
  const p2 = await resolveEp(w, EP2);
  drive(() => O.startQueue([p1, p2]));
  await sleep(80);
  const pub = publisher(O, 1248);
  pub(EP1, 0, 0, true);
  await sleep(30);
  pub(EP1, 0, 300, true);
  await sleep(30);
  O.nativeMirrorTick(); O.nativeMirrorTick();
  await sleep(120);
  const store = kill(w);
  const b2 = nativeBridge();
  const w2 = makeWorld(js, store, b2.plugin);
  await sleep(400);
  const O2 = w2.__opn;
  await paintRealDay(w2);
  let restored = null;
  if (doRestore) {
    // The restore seam's standing preconditions (its own
    // header): a series payload stands (the series page's
    // open payload) and the boot probe holds the record.
    O2.state.podcasts = JSON.parse(JSON.stringify(BIBLE515));
    if (!O2.state.podRestoreProbe) O2.state.podRestoreProbe = O2.readQueueSnapshot();
    drive(() => O2.tryStandPodcastRestore());
    await sleep(200);
    restored = { current: O2.state.current && O2.state.current.episodeId, pending: O2.state.pendingResume && O2.state.pendingResume.positionS, rec: O2.readQueueSnapshot() };
  }
  const pod2 = await resolveEp(w2, EP1);
  O2.state.current = null; O2.state.queue = []; O2.state.pendingResume = null; // the OUTSIDE-the-queue tap stands alone
  drive(() => O2.startDesc(pod2));
  await sleep(80);
  const contract = b2.cap.queues[b2.cap.queues.length - 1];
  return { w2, restored, pod2, startPos: contract ? contract.startPositionS : null };
}
{
  const r = await k3World(appJs, true);
  check('K3a ◆ queue kill regression: the v649 boot restore still stands from the queue record (snapshot position ≈300)',
    !!r.restored && !!r.restored.rec && within(r.restored.rec.positionS, 300, 6) && r.restored.current === EP1 && within(r.restored.pending, 300, 6),
    { restored: r.restored });
  check('K3b ◆ a fresh tap on the same episode OUTSIDE the restored queue resumes at the per-episode store (≈300 ±6)',
    !!r.pod2 && within(r.pod2.podPositionS, 300, 6) && within(r.startPos, 300, 6),
    { podPositionS: r.pod2 && r.pod2.podPositionS, startPos: r.startPos });
  r.w2.close();
}

// ---------- K2 ◆ web/element kill (podcast form + day form) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) });
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const pod = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: 1248, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 600;
  audio.dispatchEvent(new w.Event('timeupdate')); // the 5 s cadence tick fires the position write
  await sleep(120);
  const atKill = corePos(w, COREKEY);
  const store = kill(w);
  const w2 = makeWorld(appJs, store);
  await sleep(400);
  const O2 = w2.__opn;
  await paintRealDay(w2);
  const pod2 = await resolveEp(w2, EP1);
  drive(() => O2.startDesc(pod2));
  await sleep(80);
  check('K2 ◆ web kill, podcast: the 5 s tick wrote ≈600 before the kill and the reopen tap seats pendingResume ≈600 (±6)',
    within(atKill, 600, 6) && !!O2.state.pendingResume && within(O2.state.pendingResume.positionS, 600, 6),
    { atKill, pendingResume: O2.state.pendingResume });
  w2.close();
}
async function k2DayWorld(js) {
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const own = byId(descs, 'morning-prayer');
  drive(() => O.startDesc(own));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: 300, configurable: true }); } catch (e) {}
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  audio.currentTime = 200;
  audio.dispatchEvent(new w.Event('timeupdate'));
  // The slot assertion reads SYNCHRONOUSLY, at the kill
  // instant of the write itself: the slot holds the newest
  // value before the post's answer can land.
  const slotRaw = w.localStorage.getItem('opn-daypos-pending-v1');
  let slotVal = null;
  try { const m = JSON.parse(slotRaw || '{}'); const k = Object.keys(m).find((x) => x.indexOf('morning-prayer|') === 0); if (k) slotVal = m[k].positionS; } catch (e) {}
  await sleep(120);
  const store = kill(w);
  const w2 = makeWorld(js, store);
  await sleep(400);
  const O2 = w2.__opn;
  const r2 = await paintRealDay(w2);
  // The server fold seat (index.ts:1068-1074), stubbed as
  // harness-v617 stubbed payload marks: the reopened day
  // payload's dayPositions fold is built from what the
  // writes actually landed in the store.
  const landed = O2.opnPlayback().dayPositions['morning-prayer|' + DATE];
  if (landed) O2.state.dayPayload.dayPositions = { 'morning-prayer': landed.positionS };
  const own2 = byId(r2.descs, 'morning-prayer');
  drive(() => O2.startDesc(own2));
  await sleep(80);
  return { w2, slotVal, pending: O2.state.pendingResume && O2.state.pendingResume.positionS };
}
{
  const r = await k2DayWorld(appJs);
  check('K2 ◆ web kill, day form: the day slot held the newest value (200) at the write instant (slot parity with the podcast slot)',
    r.slotVal === 200, { slotVal: r.slotVal });
  check('K2 ◆ web kill, day form: after the kill the reopen tap resumes from the day fold (pendingResume ≈200 ±6)',
    within(r.pending, 200, 6), { pending: r.pending });
  r.w2.close();
}

// ---------- R1 ◆ pause-then-return resumes (both paths) ----------
{
  // Web path: the element pause event is the save.
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const ext = byId(descs, 'ext-morning-prayer');
  drive(() => O.startDesc(ext));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: 300, configurable: true }); } catch (e) {}
  audio.currentTime = 111;
  audio.dispatchEvent(new w.Event('pause'));
  await sleep(120);
  const pb = O.opnPlayback();
  const saved = pb.dayPositions['ext-morning-prayer|' + DATE] ? pb.dayPositions['ext-morning-prayer|' + DATE].positionS : null;
  audio.currentTime = 0;
  drive(() => O.startDesc(ext));
  await sleep(80);
  check('R1 ◆ web pause-return: the pause save landed 111 in the day store and the return tap resumes at 111 (±1)',
    saved === 111 && !!O.state.pendingResume && within(O.state.pendingResume.positionS, 111, 1),
    { saved, pendingResume: O.state.pendingResume });
  w.close();
}
{
  // Native path: the playing→paused publish is the save.
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) }, plugin);
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const pod = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod));
  await sleep(80);
  const pub = publisher(O, 1248);
  pub(EP1, 0, 0, true);
  await sleep(30);
  pub(EP1, 0, 400, true);
  await sleep(30);
  pub(EP1, 0, 400, false); // the pause flip
  await sleep(120);
  const saved = corePos(w, COREKEY);
  O.state.current = null;
  const pod2 = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod2));
  await sleep(80);
  const contract = cap.queues[cap.queues.length - 1];
  check('R1 ◆ native pause-return: the pause-flip save landed 400 in the store (asserted in the store, not the mirror) and the return tap carries 400 (±1)',
    within(saved, 400, 1) && !!contract && within(contract.startPositionS, 400, 1),
    { saved, startPositionS: contract && contract.startPositionS });
  w.close();
}

// ---------- R2 ◆ finished episode stands read, starts at the top ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) });
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  O.opnPodCoreSetPosition(SERIES, EP1, 500, 1248);
  const pod = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  audio.dispatchEvent(new w.Event('ended')); // natural end: markCompleted + clear
  await sleep(150);
  const listened = coreListened(w, COREKEY);
  const posAfter = corePos(w, COREKEY);
  const pod2 = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod2));
  await sleep(80);
  check('R2 ◆ a finished episode stands read with NO position standing, and a fresh tap starts at the top (no pendingResume)',
    listened && posAfter === null && !!pod2 && pod2.listened === true && !pod2.podPositionS && !O.state.pendingResume,
    { listened, posAfter, pod2: pod2 && { listened: pod2.listened, podPositionS: pod2.podPositionS }, pendingResume: O.state.pendingResume });
  w.close();
}

// ---------- R3 ◆ just-started (<5 s) starts at the top · R4 ◆ 12 s resumes ----------
async function nativePlayKill(js, posS) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) }, plugin);
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const pod = await resolveEp(w, EP1);
  drive(() => O.startDesc(pod));
  await sleep(80);
  const pub = publisher(O, 1248);
  pub(EP1, 0, 0, true);
  await sleep(30);
  pub(EP1, 0, posS, true);
  await sleep(30);
  O.nativeMirrorTick(); O.nativeMirrorTick();
  await sleep(120);
  const atKill = corePos(w, COREKEY);
  const store = kill(w);
  const b2 = nativeBridge();
  const w2 = makeWorld(js, store, b2.plugin);
  await sleep(400);
  const O2 = w2.__opn;
  await paintRealDay(w2);
  const pod2 = await resolveEp(w2, EP1);
  drive(() => O2.startDesc(pod2));
  await sleep(80);
  const contract = b2.cap.queues[b2.cap.queues.length - 1];
  return { w2, atKill, startPos: contract ? contract.startPositionS : null };
}
{
  const r = await nativePlayKill(appJs, 3);
  check('R3 ◆ just-started: playing to 3 s (<5 s threshold) writes NO resume position, and the post-kill tap starts at the top (startPositionS 0)',
    r.atKill === null && (r.startPos === 0 || r.startPos === null), { atKill: r.atKill, startPos: r.startPos });
  r.w2.close();
}
{
  const r = await nativePlayKill(appJs, 12);
  check('R4 ◆ threshold edge from above: playing to 12 s, killed before any pause, resumes within ±6 of 12',
    within(r.atKill, 12, 6) && within(r.startPos, 12, 6), { atKill: r.atKill, startPos: r.startPos });
  r.w2.close();
}

// ---------- M1–M3 ◆ the 95% read leg (§2.9) ----------
async function mWorld(js) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(johnWithPins([EP1])) }, plugin);
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const pod = await resolveEp(w, EP1);
  // The two standing copies M2 reads: the series-page payload
  // entry (state.podcasts, as the open series page holds it)
  // and a Praylist/dayDescs copy of the same episode.
  O.state.podcasts = JSON.parse(JSON.stringify(BIBLE515));
  // The leg's start state for this episode: unlistened, no
  // position. (The raw live capture's own listened flags are
  // John's Nov-17 progress; in the public shape the fold
  // paints entry state from the core, which stands empty
  // for this episode here — the assignment below is that
  // fold's result for the leg's copy.)
  O.state.podcasts.entries.forEach((e) => { if (e.key === EP1) { e.listened = false; e.positionS = null; } });
  O.state.dayDescs = [Object.assign({}, pod)];
  drive(() => O.startDesc(pod));
  await sleep(80);
  const pub = publisher(O, 1248);
  pub(EP1, 0, 0, true);
  await sleep(30);
  pub(EP1, 0, 1100, true); // 88% of 1248 — under the line
  await sleep(30);
  O.nativeMirrorTick();
  await sleep(120);
  const m1 = { listened: coreListened(w, COREKEY), pos: corePos(w, COREKEY) };
  pub(EP1, 0, 1200, true); // 96% of 1248 — over the line
  await sleep(30);
  O.nativeMirrorTick();
  await sleep(150);
  const entry = (O.state.podcasts.entries || []).find((e) => e.key === EP1);
  const slotRaw = w.localStorage.getItem('opn-podpos-pending-v1') || '{}';
  const m2 = {
    listened: coreListened(w, COREKEY), pos: corePos(w, COREKEY),
    praylistCopy: O.state.dayDescs[0].listened, seriesCopy: entry ? entry.listened : null,
    seriesPos: entry ? entry.positionS : 'missing', descPos: pod.podPositionS,
    slotHolds: slotRaw.includes(EP1),
  };
  const store = kill(w);
  const b2 = nativeBridge();
  const w2 = makeWorld(js, store, b2.plugin);
  await sleep(400);
  const O2 = w2.__opn;
  await paintRealDay(w2);
  const pod2 = await resolveEp(w2, EP1);
  drive(() => O2.startDesc(pod2));
  await sleep(80);
  const contract = b2.cap.queues[b2.cap.queues.length - 1];
  return { w2, m1, m2, pod2, startPos: contract ? contract.startPositionS : null };
}
{
  const r = await mWorld(appJs);
  check('M1 ◆ just under 95% (1100 of 1248): NOT read, and the position stands (≈1100)',
    r.m1.listened === false && within(r.m1.pos, 1100, 6), r.m1);
  check('M2 ◆ crossing 95% (1200 of 1248): read stands on the Praylist copy AND the series-page copy at once, and the position is cleared in every store (core · slot · payload entry · descriptor)',
    r.m2.listened === true && r.m2.pos === null && r.m2.praylistCopy === true && r.m2.seriesCopy === true
    && r.m2.seriesPos === null && r.m2.descPos === null && r.m2.slotHolds === false, r.m2);
  check('M3 ◆ kill-and-return after crossing: the track stands read and starts from the top (startPositionS 0)',
    !!r.pod2 && r.pod2.listened === true && !r.pod2.podPositionS && (r.startPos === 0 || r.startPos === null),
    { pod2: r.pod2 && { listened: r.pod2.listened, podPositionS: r.pod2.podPositionS }, startPos: r.startPos });
  r.w2.close();
}

// ---------- OA ◆ fail-on-old (the v679 tree, 43eb549) ----------
{
  const r = await k1World(oldJs);
  check('OA-K1 ◆ fail-on-old: on the v679 tree NO position write lands during native playback — the post-kill tap starts at 0 (John\u2019s defect, standing)',
    r.storeAtKill === null && (r.startPos === 0 || r.startPos === null), { storeAtKill: r.storeAtKill, startPos: r.startPos });
  r.w2.close();
}
{
  const r = await k3World(oldJs, false);
  check('OA-K3b ◆ fail-on-old: on the v679 tree the queue record is the only thing written — a fresh tap outside the queue reads no per-episode position and starts at 0',
    (r.pod2 ? !r.pod2.podPositionS : true) && (r.startPos === 0 || r.startPos === null),
    { podPositionS: r.pod2 && r.pod2.podPositionS, startPos: r.startPos });
  r.w2.close();
}
{
  const r = await k2DayWorld(oldJs);
  check('OA-K2day ◆ fail-on-old: on the v679 tree the day write is a bare post — no day slot holds the value at the write instant',
    r.slotVal === null, { slotVal: r.slotVal });
  r.w2.close();
}
{
  const r = await mWorld(oldJs);
  check('OA-M2 ◆ fail-on-old: on the v679 tree crossing 95% marks NOTHING (no threshold test stands; only the end event marks)',
    r.m2.listened === false && r.m2.seriesCopy !== true && r.m2.praylistCopy !== true, r.m2);
  r.w2.close();
}

console.log('harness-v680:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
