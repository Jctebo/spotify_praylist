// harness-v661.mjs — v661 §4: the native completion drain
// resolves each shell record to its standing descriptor and
// writes that descriptor's full played key (office side ·
// occurrence copy), and the drain runs at day stand.
//
// Mold: the v661 Plan probe (extraction of the REAL functions
// from client.ts, driven against production-shaped fixtures).
// Fixtures (Improvement D — production sources, named):
//  - descriptors as extPaintTracks650 builds them under
//    'Both' (StH first, no tag · Divine Office second with
//    _side650='do') and as the v610 emission builds a
//    twice-listed hour (the copy carries _occ=1);
//  - contract items / mediaUris as oraSnapshotTrack
//    serializes them (the REAL function, extracted);
//  - completion records in BOTH shell shapes: the 1.0.55
//    shape {episodeId, date, block} and the 1.0.56 shape
//    {+ queueIndex, mediaUri} (FaceStateStore.kt).
//
// Legs: A1–A7 (the drain, per shape) · B (reload read-back) ·
// C (full-map diff per leg — no other mark moves) · D (the
// manual v639/v655 writers unchanged).
// Fail-on-old: run with V661_CLIENT=<base client.ts path> —
// A1–A4 + A7 fail, the control shapes pass.
//
// Run: node app/harness-v661.mjs
import { readFileSync } from 'node:fs';

const CLIENT_PATH = process.env.V661_CLIENT || new URL('./worker/src/client.ts', import.meta.url).pathname;
const SRC = readFileSync(CLIENT_PATH, 'utf8');

function extract(name) {
  const start = SRC.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('not found: ' + name);
  let i = SRC.indexOf('{', start), depth = 0, j = i;
  for (; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (!depth) break; }
  }
  return SRC.slice(start, j + 1);
}

// ---- environment stubs ----
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const location = { origin: 'https://app.example' };
const PLAYED_KEY = 'opn-played-v344';
const state = {
  dayDescs: [], queue: [], repeatIds: {}, playedCache: null,
  presentedDay: '2026-11-25', dayPayload: null, current: null, queueIdx: -1,
  extSlots: {
    'ext-morning-prayer': { source: 'Divine Office', state: 'present' },
    'ext-evening-prayer': { source: 'Divine Office', state: 'present' },
  },
  extStanding: [],
};
let nativeContractDescs = [];
const refreshPlayedChrome = () => {};
const writePodMarkQuiet = () => { throw new Error('podcast branch not in these legs'); };
const homilySetPlayed = () => { throw new Error('homily branch not in these legs'); };
let completionRecords = [];
const oraBridgePlugin = () => ({ takeNativeCompletions: () => Promise.resolve({ records: completionRecords }) });

const names = ['readPlayed', 'playedMap', 'presentedDateStr', 'refreshRepeatIds', 'playedKey',
  'playedKeyOcc', 'descMarkKey', 'isPlayedDesc', 'isPlayed', 'writePlayed', 'writePlayedQuiet',
  'markCompleted', 'artUriFor', 'oraSnapshotTrack', 'drainNativeCompletions'];
const code = names.map(extract).join('\n');
eval(code + '\n;globalThis.__x = { state, localStorage, store, playedMap, refreshRepeatIds, descMarkKey, isPlayedDesc, isPlayed, writePlayed, drainNativeCompletions, oraSnapshotTrack, setRecords: (r) => { completionRecords = r; }, setContract: (d) => { nativeContractDescs = d; } };');
const X = globalThis.__x;
const { playedMap, refreshRepeatIds, isPlayedDesc, writePlayed, drainNativeCompletions, oraSnapshotTrack } = X;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DATE = '2026-11-25';

let pass = 0, fail = 0;
function ok(c, label, extra) { if (c) { pass++; console.log('ok -', label); } else { fail++; console.log('NOT OK -', label, extra ? ':: ' + extra : ''); } }

// ---- production-shaped descriptors ----
const sthDesc = { episodeId: 'ext-morning-prayer', block: 'Morning', source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', available: true };
const doDesc = { episodeId: 'ext-morning-prayer', block: 'Morning', source: 'Divine Office', title: 'Morning Prayer', _side650: 'do', available: true };
const occOrig = { episodeId: 'ext-evening-prayer', block: 'Evening', source: 'Divine Office', title: 'Evening Prayer', available: true };
const occCopy = { episodeId: 'ext-evening-prayer', block: 'Evening', source: 'Divine Office', title: 'Evening Prayer', _occ: 1, available: true };
const ownDesc = { episodeId: 'own-morning-offering', block: 'Morning', title: 'Morning Offering (Extended)', enclosureUrl: 'https://x/own.mp3', available: true };
const lastDesc = { episodeId: 'own-rosary', block: 'Evening', title: 'Rosary', enclosureUrl: 'https://x/rosary.mp3', available: true };
const ALL = [ownDesc, sthDesc, doDesc, occOrig, occCopy, lastDesc]; // the contract's order (queueIndex = position here)

function reset(descs, contract) {
  state.playedCache = null; delete store[PLAYED_KEY];
  state.dayDescs = descs; state.queue = descs.slice();
  state.dayPayload = { presentedDay: DATE, dayPositions: { 'ext-morning-prayer': { positionS: 5 } } };
  X.setContract(contract || []);
  refreshRepeatIds();
}
const uri = (d) => oraSnapshotTrack(d, DATE).mediaUri;
const rec56 = (d, idx) => ({ episodeId: d.episodeId, date: DATE, block: d.block, queueIndex: idx, mediaUri: uri(d) });
const rec55 = (d) => ({ episodeId: d.episodeId, date: DATE, block: d.block });
async function drain(records) {
  const before = JSON.stringify(playedMap());
  X.setRecords(records);
  drainNativeCompletions();
  await sleep(10);
  return before;
}
function diffOnly(before, expectedKey, label) {
  const after = playedMap();
  const b = JSON.parse(before);
  const added = Object.keys(after).filter((k) => !(k in b));
  const changed = Object.keys(b).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(after[k]));
  ok(JSON.stringify(added) === JSON.stringify([expectedKey]) && changed.length === 0,
    label, 'added=' + JSON.stringify(added) + ' changed=' + JSON.stringify(changed));
}

// ---------- Statics: the stand / foreground drain seats ----------
{
  const sRestore = SRC.slice(SRC.indexOf('function standRestoredQueue('), SRC.indexOf('audioEl.addEventListener(\'loadedmetadata\''));
  ok(sRestore.includes('drainNativeCompletions();'), 'S1 the day-stand seat: standRestoredQueue drains as the restored queue stands');
  ok(SRC.includes("if (document.visibilityState === 'visible') { reassertMediaSession(); drainNativeCompletions(); }"),
    'S2 the foreground seat: visibilitychange to visible drains');
  const dayBuild = SRC.slice(SRC.indexOf('blockInsertCards(day, standing);'), SRC.indexOf('blockInsertCards(day, standing);') + 420);
  ok(dayBuild.includes('drainNativeCompletions();'), 'S3 the day-paint seat: the day-build pass drains after the descriptors stand built');
}

// ---------- A1: Both — the DO side finishes (1.0.56 record, contract standing) ----------
reset(ALL, ALL);
{
  const before = await drain([rec56(doDesc, 2)]);
  ok(isPlayedDesc(doDesc, DATE), 'A1 DO side reads marked');
  ok(!isPlayedDesc(sthDesc, DATE), 'A1 StH side reads unmarked');
  diffOnly(before, 'ext-morning-prayer|Morning@do', 'C A1: only the DO side key is written');
}
// ---------- A2: Both — the StH side finishes ----------
reset(ALL, ALL);
{
  const before = await drain([rec56(sthDesc, 1)]);
  ok(isPlayedDesc(sthDesc, DATE), 'A2 StH side reads marked');
  ok(!isPlayedDesc(doDesc, DATE), 'A2 DO side reads unmarked');
  diffOnly(before, 'ext-morning-prayer|Morning', 'C A2: only the StH (base side) key is written');
}
// ---------- A3: Both — both sides finish (two records) ----------
reset(ALL, ALL);
{
  await drain([rec56(sthDesc, 1), rec56(doDesc, 2)]);
  ok(isPlayedDesc(sthDesc, DATE) && isPlayedDesc(doDesc, DATE), 'A3 both sides read marked, each from its own record');
}
// ---------- A4: twice-listed hour — copy and original ----------
reset(ALL, ALL);
{
  const before = await drain([rec56(occCopy, 4)]);
  ok(isPlayedDesc(occCopy, DATE), 'A4 the _occ copy reads marked');
  ok(!isPlayedDesc(occOrig, DATE), 'A4 the original reads unmarked');
  diffOnly(before, 'ext-evening-prayer|Evening#1', 'C A4: only the occurrence key is written');
}
reset(ALL, ALL);
{
  await drain([rec56(occOrig, 3)]);
  ok(isPlayedDesc(occOrig, DATE) && !isPlayedDesc(occCopy, DATE), 'A4 the original reads marked, the copy unmarked');
}
// ---------- A5: ordinary episode · the queue's LAST track ----------
reset(ALL, ALL);
{
  await drain([rec56(ownDesc, 0)]);
  ok(isPlayedDesc(ownDesc, DATE), 'A5 ordinary episode reads marked');
}
reset(ALL, ALL);
{
  await drain([rec56(lastDesc, 5)]);
  ok(isPlayedDesc(lastDesc, DATE), 'A5 the queue\'s last track (the ended arm\'s record) reads marked');
}
// ---------- A5b: mediaUri leg — contract retired, record resolves by address ----------
reset(ALL, []);
{
  await drain([rec56(doDesc, 2)]);
  ok(isPlayedDesc(doDesc, DATE) && !isPlayedDesc(sthDesc, DATE), 'A5b a retired-contract record resolves by mediaUri to the DO side');
}
// ---------- A6: old-shell records (1.0.55 shape) ----------
reset([sthDesc], []);
{
  await drain([rec55(sthDesc)]);
  ok(isPlayedDesc(sthDesc, DATE), 'A6 old-shell record, single-source office: resolves (sole candidate) and marks');
}
reset([ownDesc], []);
{
  await drain([rec55(ownDesc)]);
  ok(isPlayedDesc(ownDesc, DATE), 'A6 old-shell record, ordinary episode: marks');
}
reset(ALL, []);
{
  await drain([rec55(doDesc)]);
  ok(isPlayedDesc(sthDesc, DATE) && !isPlayedDesc(doDesc, DATE),
    'A6 old-shell record under Both with a dead contract: falls back to the base key (the named limitation, asserted as such)');
}
// ---------- A7: dead-page timing — a record standing at page stand drains on stand ----------
reset(ALL, ALL);
{
  // No playback contact: the record stands in the store and
  // the stand seat's call is the drain itself.
  const before = await drain([rec56(doDesc, 2)]);
  ok(isPlayedDesc(doDesc, DATE), 'A7 a record standing at stand drains on stand and the finished side reads marked');
  diffOnly(before, 'ext-morning-prayer|Morning@do', 'C A7: only the finished side key is written');
}
// ---------- B: reload read-back ----------
{
  state.playedCache = null; // a fresh playedMap reads localStorage, as at reload
  ok(isPlayedDesc(doDesc, DATE), 'B the A7 mark survives a simulated reload (store read-back)');
}
// ---------- D: manual marks (the v639/v655 writers) land as before ----------
{
  ok(SRC.includes("writePlayed(t.episodeId, presentedDateStr(), on ? 'marked' : null, t.block || t._block || '', t._occ || 0, t._side650 || null)"),
    'D statics: the card writer still passes the full key (occ + side)');
  reset(ALL, ALL);
  writePlayed(occCopy.episodeId, DATE, 'marked', occCopy.block, occCopy._occ || 0, occCopy._side650 || null);
  ok(isPlayedDesc(occCopy, DATE) && !isPlayedDesc(occOrig, DATE), 'D a manual mark on the copy lands on the copy only');
  writePlayed(doDesc.episodeId, DATE, 'marked', doDesc.block, 0, 'do');
  ok(isPlayedDesc(doDesc, DATE) && !isPlayedDesc(sthDesc, DATE), 'D a manual mark on the DO side lands on the side only');
}

// ---------- H1: 1.0.56 DO record, only the StH side standing (Review F1) ----------
reset([sthDesc], []);
{
  const before = await drain([{ episodeId: doDesc.episodeId, date: DATE, block: doDesc.block, queueIndex: -1, mediaUri: uri(doDesc) }]);
  ok(JSON.stringify(playedMap()) === before && !isPlayedDesc(sthDesc, DATE) && !isPlayedDesc(doDesc, DATE),
    'H1 a present-but-unmatched mediaUri skips the record: no key written, the store stands unchanged');
  ok(!!(state.dayPayload && state.dayPayload.dayPositions && state.dayPayload.dayPositions['ext-morning-prayer']),
    'H1 the skipped record leaves dayPositions untouched');
}
// ---------- H2: 1.0.56 record whose mediaUri matches no candidate, both sides standing (Review F1) ----------
reset(ALL, ALL);
{
  const before = await drain([{ episodeId: sthDesc.episodeId, date: DATE, block: sthDesc.block, queueIndex: -1, mediaUri: 'ora://unmatched-recording' }]);
  ok(JSON.stringify(playedMap()) === before && !isPlayedDesc(sthDesc, DATE) && !isPlayedDesc(doDesc, DATE),
    'H2 a mediaUri matching no candidate writes nothing (no base-key fallback)');
}
// ---------- H3b: lone _side650 descriptor as distinct-but-equal objects (Review F2) ----------
{
  const doQueue = { episodeId: doDesc.episodeId, block: doDesc.block, source: doDesc.source, title: doDesc.title, _side650: 'do', available: true };
  const doDay = { episodeId: doDesc.episodeId, block: doDesc.block, source: doDesc.source, title: doDesc.title, _side650: 'do', available: true };
  reset([doQueue], []);
  state.dayDescs = [doDay];
  const before = await drain([rec55(doDesc)]);
  ok(isPlayedDesc(doDesc, DATE), 'H3b distinct-but-equal lone side descriptors dedupe to a sole candidate and its own key is marked');
  diffOnly(before, 'ext-morning-prayer@do', 'C H3b: only the side key is written');
}

console.log(`\nharness-v661: ${pass} ok, ${fail} not ok`);
process.exit(fail ? 1 : 0);
