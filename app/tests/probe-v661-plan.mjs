// Plan probe v661 — extracts the REAL functions from the shipped client.ts
// and drives the two completion paths (web markCompleted · native drain)
// against production-shaped descriptors. No code modified; read-only proof.
import { readFileSync } from 'node:fs';

const SRC = readFileSync(process.env.HOME + '/workspace/.worktrees/v661/app/worker/src/client.ts', 'utf8');

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
const state = { dayDescs: [], repeatIds: {}, playedCache: null, presentedDay: '2026-11-25', dayPayload: null, current: null, queue: [], queueIdx: -1 };
let chromeRefreshes = 0;
const refreshPlayedChrome = () => { chromeRefreshes++; };
const writePodMarkQuiet = () => { throw new Error('podcast branch not in these legs'); };
const homilySetPlayed = () => { throw new Error('homily branch not in these legs'); };
let completionRecords = [];
const oraBridgePlugin = () => ({ takeNativeCompletions: () => Promise.resolve({ records: completionRecords }) });

const names = ['readPlayed', 'playedMap', 'presentedDateStr', 'refreshRepeatIds', 'playedKey',
  'playedKeyOcc', 'descMarkKey', 'isPlayedDesc', 'isPlayed', 'writePlayed', 'writePlayedQuiet',
  'markCompleted', 'drainNativeCompletions'];
const code = names.map(extract).join('\n');
eval(code + '\n;globalThis.__x = { state, localStorage, store, playedMap, refreshRepeatIds, descMarkKey, isPlayedDesc, markCompleted, drainNativeCompletions, setRecords: (r) => { completionRecords = r; }, playedKeyOcc };');
const X = globalThis.__x;
const { playedMap, refreshRepeatIds, descMarkKey, isPlayedDesc, markCompleted, drainNativeCompletions } = X;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, label, extra) { if (c) { pass++; console.log('ok -', label); } else { fail++; console.log('NOT OK -', label, extra ? ':: ' + extra : ''); } }

// ---- production-shaped descriptors: Morning under 'Both' (v650 paint) ----
// StH paints first (standing sort), Divine Office second with _side650='do'.
// Plus a twice-listed Divine Office hour in Evening (v610, _occ=1 on the copy),
// and one ordinary own episode.
const sthDesc = { episodeId: 'ext-morning-prayer', block: 'Morning', source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours' };
const doDesc  = { episodeId: 'ext-morning-prayer', block: 'Morning', source: 'Divine Office', title: 'Morning Prayer', _side650: 'do' };
const occDesc = { episodeId: 'ext-evening-prayer', block: 'Evening', source: 'Divine Office', title: 'Evening Prayer', _occ: 1 };
const ownDesc = { episodeId: 'own-morning-offering', block: 'Morning', title: 'Morning Offering (Extended)' };
state.dayDescs = [sthDesc, doDesc, occDesc, ownDesc];
refreshRepeatIds();

console.log('read keys:');
console.log('  StH side  :', descMarkKey(sthDesc));
console.log('  DO side   :', descMarkKey(doDesc));
console.log('  occ copy  :', descMarkKey(occDesc));
console.log('  own       :', descMarkKey(ownDesc));

// ---- Leg 1 (CONTROL): the WEB completion path marks every shape ----
// markCompleted is the element 'ended' writer; it holds the full descriptor.
markCompleted(doDesc);
ok(isPlayedDesc(doDesc, '2026-11-25'), 'CONTROL web markCompleted: DO side reads marked');
ok(!isPlayedDesc(sthDesc, '2026-11-25'), 'CONTROL web markCompleted: StH side untouched');
markCompleted(occDesc);
ok(isPlayedDesc(occDesc, '2026-11-25'), 'CONTROL web markCompleted: occ copy reads marked');
state.playedCache = null; delete store['opn-played-v344']; // reset store

// ---- Leg 2: the NATIVE drain folds identity-only records (the field path) ----
// The shell's records are {episodeId, date, block} — FaceStateStore.kt's shape.
// A Divine Office finish under Both produces exactly this record:
X.setRecords([{ episodeId: 'ext-morning-prayer', date: '2026-11-25', block: 'Morning' }]);
drainNativeCompletions();
await sleep(10);
const keys = Object.keys(playedMap());
console.log('store keys after native drain of a DO finish:', JSON.stringify(keys));
ok(!isPlayedDesc(doDesc, '2026-11-25'), 'DEFECT native drain: the finished DO side reads UNMARKED');
ok(isPlayedDesc(sthDesc, '2026-11-25'), 'DEFECT native drain: the unplayed StH side reads MARKED (base-key landing)');
state.playedCache = null; delete store['opn-played-v344'];

// ---- Leg 3: a twice-listed hour's finish through the drain ----
X.setRecords([{ episodeId: 'ext-evening-prayer', date: '2026-11-25', block: 'Evening' }]);
drainNativeCompletions();
await sleep(10);
ok(!isPlayedDesc(occDesc, '2026-11-25'), 'DEFECT native drain: the finished occ copy reads UNMARKED');
console.log('store keys after occ drain:', JSON.stringify(Object.keys(playedMap())));
state.playedCache = null; delete store['opn-played-v344'];

// ---- Leg 4: an ordinary episode through the drain (the shape that works) ----
X.setRecords([{ episodeId: 'own-morning-offering', date: '2026-11-25', block: 'Morning' }]);
drainNativeCompletions();
await sleep(10);
ok(isPlayedDesc(ownDesc, '2026-11-25'), 'native drain: ordinary episode reads marked (the sometimes)');

console.log(`\nprobe: ${pass} ok, ${fail} not ok`);
process.exit(fail ? 1 : 0);
