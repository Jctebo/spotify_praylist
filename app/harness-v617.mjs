// harness-v617.mjs — v617: John's correction on the v616
//  block play disc (2026-11-22 09:54 CT): "The play disc
//  needs to honor the existing mark where the prayer is.
//  It shouldn't automatically start a track over if it
//  isn't finished" — when a block's play disc starts its
//  queue, EVERY track's start honors its stored position
//  mark (the single-play discipline): an unfinished track
//  resumes at its mark, never at 0:00; a finished track
//  (played mark stands, position row gone) starts at 0.
// The ELEMENT queue path already honored marks through
//  startDesc's standing reads (E1–E5: regression guards,
//  expected to pass on the old tree). The defect stood in
//  the NATIVE engine path: the contract carries only the
//  START item's position and the engine advances through
//  its window autonomously, so every later track began at
//  0:00 — the fix seeks the new track to its mark on each
//  engine transition (applyNativeState's changed block),
//  once, through the standing nativeTransport seekTo (the
//  Now Playing scrub's own command). Plus the current-
//  track carry: a start whose descriptor IS the standing
//  current carries the LIVE position (the mirror's, via
//  playPos(); the element's currentTime), never a stale
//  fold value (E6 element form · N8 native form).
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone
//    served); its dayPositions fold stands EMPTY in the
//    fixture, so the harness writes marks onto REAL
//    episodeIds of that day (a Morning own episode,
//    'morning-prayer' · a Morning external slot track,
//    'ext-morning-prayer') at plausible partway positions.
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document.
//  - The podcast contents episode is the v614 resolve
//    path: a {kind:'episode', key:'bible-in-a-year|
//    biy:day-5'} item in the Salesian profile's Morning
//    contents, its position written through the client's
//    own opnPodCoreSetPosition (123 s of 900) — the
//    resolved descriptor (state.episodeRes614) carries
//    podPositionS 123 from the core fold, exactly the
//    descriptor that stands in a queue; the series payload
//    is tests/fixtures-v603/bible-folded.json (the
//    production Bible in a Year payload, core-folded).
//  - The Episodes tail is production-shaped from the day
//    payload's own episodes seam (the v616 P7 recipe).
// Native worlds: the bridge stub carries setNativeQueue +
//  nativeTransport (oraNativeMode's own capability read)
//  and NO oneEngine method — the old-pair discipline,
//  which is pair-agnostic for the transition seek (it
//  rides applyNativeState, common to both pairs).
// Direct start calls are wrapped in drive(): jsdom's
//  HTMLMediaElement.play() returns undefined, so the
//  client's play().catch throws inside the element tail
//  when a start is invoked from Node rather than from a
//  DOM event; every bookkeeping seat the legs assert
//  (pendingResume, the contract send) runs ahead of that
//  tail, exactly as in production.
// The old-client ref is the v616 tree (a54db0e), pinned by
//  commit: the OA legs must FAIL there (no transition seek
//  stands; the head carry reads the fold, not the live
//  position).
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
const oldClientSrc = git(['show', 'a54db0e:app/worker/src/client.ts']); // fail-on-old pin: the v616 tree
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';

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
check('T0b the v617 seats stand in the client: the queueMarkPos617 reader (podcast fold first, prayer/homily 0, else the dayPositions fold), the native transition seekTo in applyNativeState, and the startDesc live carry (sameCur617/liveCarry617)',
  clientSrc.includes('function queueMarkPos617(desc)')
  && clientSrc.includes("nativeTransportSend({ command: 'seekTo', positionS: mark617 })")
  && clientSrc.includes('var sameCur617 = ') && clientSrc.includes('var liveCarry617 = -1;')
  && clientSrc.includes('state.pendingResume = liveCarry617 > 0'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v617:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, resolveProfileEpisodes614, opnPodCoreSetPosition, markCompleted, writePlayed, isPlayedDesc, refreshPlayedChrome, opnCounts615, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, applyNativeState, nativeContractFor, startQueue, advanceQueue, startDesc, queueMarkPos617, oraNativeMode, playPos };';
const OLD_HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, resolveProfileEpisodes614, opnPodCoreSetPosition, markCompleted, writePlayed, isPlayedDesc, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, applyNativeState, nativeContractFor, startQueue, advanceQueue, startDesc, oraNativeMode, playPos };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge, hook) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + (hook || HOOK);
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
// The native bridge stub: captures the setNativeQueue
// contracts and the nativeTransport commands verbatim.
// No oneEngine method — the old-pair discipline stands
// (the transition seek is pair-agnostic).
function nativeBridge() {
  const cap = { queues: [], transports: [] };
  const plugin = {
    setNativeQueue: (arg) => { cap.queues.push(JSON.parse(arg.queue)); return Promise.resolve({}); },
    nativeTransport: (arg) => { cap.transports.push(JSON.parse(arg.command)); return Promise.resolve({}); },
    addListener: () => Promise.resolve({ remove: () => {} }),
  };
  return { plugin, cap };
}
const seeksOf = (cap) => cap.transports.filter((t) => t.command === 'seekTo');
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
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
async function paintRealDay(w, daySrc) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(daySrc || DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
const byId = (descs, id) => (descs || []).find((d) => d.episodeId === id);
// The v614 contents-episode world seed: John's document
// with the Salesian Morning contents carrying ONE episode
// pin (biy:day-5), its core position written through the
// client's own seam at 123 s.
function johnWithPin() {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: [{ kind: 'episode', key: 'bible-in-a-year|biy:day-5' }] });
  return doc;
}
async function resolvePin(w) {
  const O = w.__opn;
  O.opnPodCoreSetPosition('bible-in-a-year', 'biy:day-5', 123, 900);
  O.resolveProfileEpisodes614(O.state.dayPayload);
  const end = Date.now() + 8000;
  while (Date.now() < end && !(O.state.episodeRes614 && O.state.episodeRes614['Morning:bible-in-a-year|biy:day-5'])) await sleep(100);
  await sleep(120);
  return O.state.episodeRes614 && O.state.episodeRes614['Morning:bible-in-a-year|biy:day-5'];
}
// The engine-state publisher for native worlds: crafted
// state JSON through the client's own applyNativeState,
// ts strictly increasing (the publish-order guard).
function publisher(O) {
  let ts = Date.now();
  return (trackId, queueIndex, positionS, playing) => O.applyNativeState(JSON.stringify({
    engine: 'native', trackId, queueIndex, positionS, durationS: 600, playing: !!playing, rate: 1, ts: ++ts,
  }));
}

// ---------- E1–E6 ◆ element world (regression guards + the element carry) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const own = byId(descs, 'morning-prayer');       // a Morning OWN episode of the production day
  const ext = byId(descs, 'ext-morning-prayer');   // a Morning EXTERNAL slot track of the production day
  const fin = byId(descs, 'daily-rosary');         // the finished-track target
  const hair = byId(descs, 'marian-antiphon');     // the hair-from-the-end target
  check('E0 the production day stands with the leg tracks (own · external · rosary · antiphon, all available)',
    !!own && !!ext && !!fin && !!hair && own.available && ext.available && fin.available && hair.available,
    { own: !!own, ext: !!ext, fin: !!fin, hair: !!hair });
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'duration', { value: 300, configurable: true }); } catch (e) {}
  // Marks on REAL episodeIds of the production day, in the
  // payload fold the harness serves (the fixture's own
  // fold stands empty): own partway at 222.7, external
  // partway at 111, the antiphon a hair past the end
  // (300.4 — saved against a longer cut).
  O.state.dayPayload.dayPositions = { 'morning-prayer': 222.7, 'ext-morning-prayer': 111, 'marian-antiphon': 300.4 };
  drive(() => O.startQueue([own, ext, fin, hair]));
  await sleep(80);
  check('E1 ◆ disc-queue FIRST track resumes at its fold mark: startDesc seats pendingResume at floor(222.7) = 222 for the own episode, and the loadedmetadata seam seeks the element there',
    !!O.state.current && O.state.current.episodeId === 'morning-prayer'
    && !!O.state.pendingResume && O.state.pendingResume.positionS === 222,
    { current: O.state.current && O.state.current.episodeId, pendingResume: O.state.pendingResume });
  audio.dispatchEvent(new w.Event('loadedmetadata'));
  await sleep(30);
  check('E1b the element stands at the mark after loadedmetadata (currentTime 222) and the seam is consumed',
    audio.currentTime === 222 && O.state.pendingResume === null, { currentTime: audio.currentTime });
  drive(() => O.advanceQueue(1));
  await sleep(80);
  const pr2 = O.state.pendingResume;
  audio.dispatchEvent(new w.Event('loadedmetadata'));
  await sleep(30);
  check('E2 ◆ advanceQueue to a partway day track resumes at ITS mark: the external slot track seats pendingResume 111 and the element seeks to 111',
    !!O.state.current && O.state.current.episodeId === 'ext-morning-prayer' && !!pr2 && pr2.positionS === 111 && audio.currentTime === 111,
    { current: O.state.current && O.state.current.episodeId, pr2, currentTime: audio.currentTime });
  // E6 rides this standing current: the element's LIVE
  // position (160) stands ahead of the track's fold mark
  // (111) — a re-start of the standing current carries
  // the live position, not the fold (the element form of
  // the N8 carry; FAILS on the old tree by design).
  audio.currentTime = 160;
  drive(() => O.startDesc(O.state.current));
  await sleep(80);
  check('E6 ◆ current-track carry (element): re-starting the standing current seats pendingResume at the LIVE element position 160, not the fold\u2019s 111',
    !!O.state.pendingResume && O.state.pendingResume.episodeId === 'ext-morning-prayer' && O.state.pendingResume.positionS === 160,
    { pendingResume: O.state.pendingResume });
  audio.dispatchEvent(new w.Event('loadedmetadata')); // consume the carry, as production does
  await sleep(30);
  // E4: the rosary is FINISHED — its played mark stands
  // through the standing write and NO fold row stands for
  // it (the stores' discipline: the row deletes at end).
  O.writePlayed('daily-rosary', DATE, 'marked', 'Morning', 0);
  drive(() => O.advanceQueue(1));
  await sleep(80);
  const pr4 = O.state.pendingResume;
  audio.currentTime = 0; // the src swap's reset, simulated (jsdom holds one element across tracks)
  audio.dispatchEvent(new w.Event('loadedmetadata'));
  await sleep(30);
  check('E4 ◆ a finished track (played mark stands, no position row) starts at 0: no pendingResume seats at its start and the element stands at 0 after loadedmetadata',
    !!O.state.current && O.state.current.episodeId === 'daily-rosary' && pr4 === null && audio.currentTime === 0,
    { current: O.state.current && O.state.current.episodeId, pr4, currentTime: audio.currentTime });
  // E5: advance to the antiphon — its fold mark (300.4)
  // floors to 300, at the element's end; the shared-seam
  // guard clamps the seek to duration−1 = 299.
  drive(() => O.advanceQueue(1));
  await sleep(80);
  const pr5 = O.state.pendingResume;
  audio.dispatchEvent(new w.Event('loadedmetadata'));
  await sleep(30);
  check('E5 ◆ a mark a hair from the end seeks CLAMPED to duration\u22121: pendingResume floors to 300 and the loadedmetadata seam lands the element at 299 (duration 300), never on the end',
    !!O.state.current && O.state.current.episodeId === 'marian-antiphon' && !!pr5 && pr5.positionS === 300 && audio.currentTime === 299,
    { current: O.state.current && O.state.current.episodeId, pr5, currentTime: audio.currentTime });
  w.close();
}

// ---------- E3 ◆ element advance to a v614 contents podcast episode ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(johnWithPin()) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const pod = await resolvePin(w);
  const head = byId(descs, 'marian-antiphon-midday'); // a Midday day track — the pin world's Morning contents carry the pin alone, so the queue's head stands in an untouched block
  check('E3a the v614 resolve path stands: the contents pin resolves to a podcast descriptor carrying podPositionS 123 from the core fold',
    !!pod && pod.kind === 'podcast' && pod.podPositionS === 123 && !!head,
    { pod: pod && { kind: pod.kind, podPositionS: pod.podPositionS }, head: !!head });
  if (pod && head) {
    const audio = w.document.getElementById('audio');
    try { Object.defineProperty(audio, 'duration', { value: 1049, configurable: true }); } catch (e) {}
    drive(() => O.startQueue([head, pod]));
    await sleep(80);
    const standing = O.state.queue[1];
    // The advance step drives startDesc — advanceQueue's
    // own funnel call — on the descriptor the queue holds
    // at birth. (advanceQueue's queueLiveDesc re-resolution
    // would swap it for the dayDescs placement copy, which
    // the trackDesc whitelist strips of kind/podPositionS —
    // a standing v614 seam on BOTH trees, outside this
    // build; the native contract carries the birth-standing
    // descriptor, as N3 proves.)
    O.state.queueIdx = 1;
    drive(() => O.startDesc(standing));
    await sleep(80);
    const pr = O.state.pendingResume;
    audio.dispatchEvent(new w.Event('loadedmetadata'));
    await sleep(30);
    check('E3 ◆ advance to the partway contents podcast episode resumes at its podPositionS: the queue\u2019s birth-standing entry IS the resolver descriptor, and its start seats pendingResume 123 for biy:day-5 and the element seeks there',
      standing === pod && !!O.state.current && O.state.current.episodeId === 'biy:day-5' && !!pr && pr.positionS === 123 && audio.currentTime === 123,
      { standingIsPod: standing === pod, current: O.state.current && O.state.current.episodeId, pr, currentTime: audio.currentTime });
  }
  w.close();
}

// ---------- N1 · N2 · N4 · N5 · N9 ◆ native transition seeks (one world, one queue) ----------
async function nativeMarksWorld(js, hook) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin, hook);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const a = byId(descs, 'ext-invitatory');   // mark 45
  const b = byId(descs, 'morning-prayer');   // mark 300
  const c = byId(descs, 'ext-morning-prayer'); // no mark
  O.state.dayPayload.dayPositions = { 'ext-invitatory': 45, 'morning-prayer': 300 };
  drive(() => O.startQueue([a, b, c]));
  await sleep(80);
  return { w, O, cap, pub: publisher(O) };
}
{
  const { w, O, cap, pub } = await nativeMarksWorld(appJs, HOOK);
  const contract = cap.queues[cap.queues.length - 1];
  check('N0 the native world stands: oraNativeMode reads the bridge stub, and the disc queue\u2019s contract carries the head\u2019s fold mark as its startPositionS (45)',
    O.oraNativeMode() === true && !!contract && contract.startPositionS === 45,
    { contract: contract && { startPositionS: contract.startPositionS, n: contract.items.length } });
  pub('ext-invitatory', 0, 45, true); // the start's playing ack — closes the pending window
  await sleep(30);
  pub('morning-prayer', 1, 0, true); // N1: the engine transitions to the partway own track
  await sleep(30);
  const s1 = seeksOf(cap);
  check('N1 ◆ a transition to a partway day track sends ONE seekTo at its fold mark (300)',
    s1.length === 1 && s1[0].positionS === 300 && !!O.state.current && O.state.current.episodeId === 'morning-prayer',
    { seeks: s1, current: O.state.current && O.state.current.episodeId });
  pub('morning-prayer', 1, 0, true); // N5: a repeat publish of the same track
  await sleep(30);
  check('N5 ◆ repeat publishes of the same track send NO second seek (the changed gate fires once per track change)',
    seeksOf(cap).length === 1, { seeks: seeksOf(cap) });
  pub('ext-morning-prayer', 2, 0, true); // N2: a transition to a track with no mark
  await sleep(30);
  check('N2 ◆ a transition to a track with NO mark sends no seek',
    seeksOf(cap).length === 1 && !!O.state.current && O.state.current.episodeId === 'ext-morning-prayer',
    { seeks: seeksOf(cap), current: O.state.current && O.state.current.episodeId });
  pub('morning-prayer', 1, 0, true); // N9: a BACKWARD transition to the partway track
  await sleep(30);
  const s9 = seeksOf(cap);
  check('N9 ◆ a backward transition to a partway track seeks the same way (seekTo 300)',
    s9.length === 2 && s9[1].positionS === 300, { seeks: s9 });
  pub('ext-invitatory', 0, 50, true); // N4: published already PAST its mark (50 ≥ 45)
  await sleep(30);
  check('N4 ◆ a transition whose published position already stands at/past the mark sends no seek',
    seeksOf(cap).length === 2 && !!O.state.current && O.state.current.episodeId === 'ext-invitatory',
    { seeks: seeksOf(cap), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- N3 ◆ native transition to a v614 contents podcast episode ----------
{
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(johnWithPin()) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const pod = await resolvePin(w);
  const head = byId(descs, 'marian-antiphon-midday'); // as in E3: the queue's head stands in an untouched block
  drive(() => O.startQueue([head, pod]));
  await sleep(80);
  const contract = cap.queues[cap.queues.length - 1];
  const pub = publisher(O);
  pub('marian-antiphon-midday', 0, 0, true);
  await sleep(30);
  pub('biy:day-5', 1, 0, true);
  await sleep(30);
  const s = seeksOf(cap);
  check('N3 ◆ a transition to a partway podcast contents episode sends seekTo at its podPositionS (123) — the contract carried the episode as its second item',
    !!contract && contract.items.length >= 2 && contract.items[1].id === 'biy:day-5'
    && s.length === 1 && s[0].positionS === 123,
    { items: contract && contract.items.map((i) => i.id), seeks: s });
  w.close();
}

// ---------- N6 ◆ the Episodes tail queue's transition seeks the same way ----------
{
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const daySrc = JSON.parse(JSON.stringify(DAY597));
  daySrc.episodes = [
    { episodeId: 'tail-1', title: 'Tail episode one', streamUrl: 'https://example.invalid/t1.mp3', available: true, durationS: 30 },
    { episodeId: 'tail-2', title: 'Tail episode two', streamUrl: 'https://example.invalid/t2.mp3', available: true, durationS: 30 },
  ];
  const { descs } = await paintRealDay(w, daySrc);
  const tail = (descs || []).filter((x) => !x.block);
  O.state.dayPayload.dayPositions = { 'tail-2': 77 };
  drive(() => O.startQueue(tail));
  await sleep(80);
  const pub = publisher(O);
  pub('tail-1', 0, 0, true);
  await sleep(30);
  pub('tail-2', 1, 0, true);
  await sleep(30);
  const s = seeksOf(cap);
  const contract = cap.queues[cap.queues.length - 1];
  check('N6 ◆ the Episodes tail queue\u2019s transition seeks the same way: the tail contract stands (queueEnd 2) and the transition to tail-2 sends seekTo at its fold mark (77)',
    tail.length === 2 && !!contract && contract.queueEnd === 2 && s.length === 1 && s[0].positionS === 77,
    { tail: tail.map((t) => t.episodeId), queueEnd: contract && contract.queueEnd, seeks: s });
  w.close();
}

// ---------- N7 ◆ a transition to an occurrence copy seeks the shared episodeId mark ----------
{
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const base = byId(descs, 'ext-morning-prayer');
  const copy0 = base;
  const copy1 = Object.assign({}, base, { _occ: 1 }); // the v610 occurrence copy: same episodeId, occurrence-stamped
  O.state.dayPayload.dayPositions = { 'ext-morning-prayer': 140 };
  drive(() => O.startQueue([copy0, copy1]));
  await sleep(80);
  const pub = publisher(O);
  pub('ext-morning-prayer', 0, 140, true);
  await sleep(30);
  pub('ext-morning-prayer', 1, 0, true); // the engine transitions to the COPY (queueIndex 1)
  await sleep(30);
  const s = seeksOf(cap);
  check('N7 ◆ a transition to an occurrence copy seeks the SHARED episodeId mark: copies share the one stored position (only the played mark is occurrence-keyed), so the copy\u2019s transition sends seekTo 140',
    !!base && s.length === 1 && s[0].positionS === 140 && O.state.queueIdx === 1,
    { seeks: s, queueIdx: O.state.queueIdx });
  w.close();
}

// ---------- N8 ◆ the currently-playing carry (native) ----------
// The head became current by an ENGINE TRANSITION (its
// pendingResume never stood — the transition path seats
// none), the mirror's live position (200) stands ahead
// of the fold (45): a disc re-start of that head sends a
// contract whose startPositionS is the LIVE position.
async function nativeCarryWorld(js, hook) {
  const { plugin, cap } = nativeBridge();
  const w = makeWorld(js, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin, hook);
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const a = byId(descs, 'ext-invitatory');
  const b = byId(descs, 'morning-prayer');
  const c = byId(descs, 'ext-morning-prayer');
  O.state.dayPayload.dayPositions = { 'morning-prayer': 45 };
  drive(() => O.startQueue([a, b, c]));
  await sleep(80);
  const pub = publisher(O);
  pub('ext-invitatory', 0, 0, true);
  await sleep(30);
  pub('morning-prayer', 1, 0, true);  // the engine transition seats b as current
  await sleep(30);
  pub('morning-prayer', 1, 200, false); // the mirror stands at the LIVE 200, paused (no extrapolation drift)
  await sleep(30);
  drive(() => O.startQueue([b, c])); // the disc re-start: the queue's head IS the standing current
  await sleep(80);
  return { w, O, cap };
}
{
  const { w, cap } = await nativeCarryWorld(appJs, HOOK);
  const last = cap.queues[cap.queues.length - 1];
  check('N8 ◆ the currently-playing carry: the disc queue\u2019s head IS the standing current (mirror live 200, fold 45) — the sent contract\u2019s startPositionS is the LIVE position 200, not the fold\u2019s 45',
    !!last && last.startPositionS === 200, { startPositionS: last && last.startPositionS, contracts: cap.queues.length });
  w.close();
}

// ---------- OA ◆ fail-on-old (the v616 tree, a54db0e) ----------
{
  const { w, cap, pub } = await nativeMarksWorld(oldJs, OLD_HOOK);
  pub('ext-invitatory', 0, 45, true);
  await sleep(30);
  pub('morning-prayer', 1, 0, true);
  await sleep(30);
  pub('ext-morning-prayer', 2, 0, true);
  await sleep(30);
  pub('morning-prayer', 1, 0, true);
  await sleep(30);
  check('OA1 ◆ fail-on-old: on the v616 client the N1/N2/N9 sequence sends NO seekTo at all — the engine\u2019s later tracks start at 0:00 whatever mark they hold (John\u2019s defect, standing)',
    seeksOf(cap).length === 0 && cap.transports.length === 0, { transports: cap.transports });
  w.close();
}
{
  const { w, cap } = await nativeCarryWorld(oldJs, OLD_HOOK);
  const last = cap.queues[cap.queues.length - 1];
  check('OA2 ◆ fail-on-old: on the v616 client the head carry reads the FOLD (startPositionS 45), not the mirror\u2019s live 200 — the playing track jumps back to the stale store value',
    !!last && last.startPositionS === 45, { startPositionS: last && last.startPositionS });
  w.close();
}

console.log('harness-v617:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
