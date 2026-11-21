// harness-v570.mjs — v570 export / import verification.
//
// S-legs (static, against the BASE tree):
//   S1 the diff vs BASE is confined to app/worker/src/client.ts
//      and this harness (no index.ts, no service worker change).
//   S2 migrations unchanged vs BASE; the newest stays 0042.
//   S3 the SW pin is unmoved vs BASE pre-Ship (the pin moves
//      only in the Ship commit, to ora-pro-nobis-v570-1).
//   S4 the v570 surface strings stand in client.ts (the My data
//      section, the snapshot key, the refusal lines).
//   S5 PIN material never travels: the export/import code slice
//      contains no read of the PIN store key.
//
// L-legs (the REAL v568+v570 client layer in Node vm worlds,
// public shape; fixture: John's generated import file — drawn
// from the live app D1 by the v570 generator, read-only):
//   L1 Save a copy: the envelope parses, format + formatVersion
//      stand, and the counts header equals the sections.
//   L2 PIN census: with a PIN set on the device, the export
//      string carries no PIN record material and no PIN field.
//   L3 Restore into a fresh world adopts the copy: every class
//      reads back through the layer's own local API.
//   L4 A newer formatVersion is refused with the plain line;
//      the standing document is untouched.
//   L5 A count-mismatched copy is refused; document untouched.
//   L6 A foreign file is refused; document untouched.
//   L7 Snapshot + undo: a restore keeps the pre-restore
//      document on the device; undo brings it back whole.
//   L8 John's import file dry-run-restores in a fresh world:
//      returned counts equal the file header, and the classes
//      read back (19 intentions, the Salesian standing, the
//      book favorites, a Universal Prayer date).
//   L9 seq survival: after John's restore, a new intention
//      takes id 20 — no collision with the restored ids.
//   L10 Web mode stands apart: opnMode() reads 'web' off-shell
//      and the layer still refuses personal writes there
//      (the v568 pointer refusal), so no copy can be made or
//      restored where nothing is stored.
//
// Run: node harness-v570.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || 'origin/main';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8' });

// ---------- S-legs ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean)
  .map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/client.ts', 'harness-v570.mjs']);
check('S1 diff confined to client.ts + harness-v570.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S2 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
check('S4 My data section stands', clientSrc.includes('MY DATA ON THIS PHONE') && clientSrc.includes('set-mydata-save') && clientSrc.includes('set-mydata-restore'));
check('S4 snapshot key + refusal lines stand',
  clientSrc.includes("OPN_SNAPSHOT_KEY = 'opn-personal-data-snapshot-v1'")
  && clientSrc.includes('This copy was made by a newer version of Ora Pro Nobis')
  && clientSrc.includes('its counts do not match its contents'));
const v570slice = clientSrc.slice(clientSrc.indexOf('v570: export / import'), clientSrc.indexOf('var OPN_SEED_PROFILES'));
check('S5 export/import slice never reads the PIN store', !v570slice.includes('OPN_PIN_KEY') && !v570slice.includes('opnPin'), v570slice.length);

// ---------- world builder (the harness-v568 pattern) ----------
const layerStart = clientSrc.indexOf('/* ---------------- v568: local personal data');
const layerEnd = clientSrc.indexOf('function api(path, opts) {');
const apiEnd = clientSrc.indexOf('function post(path, body)');
if (layerStart < 0 || layerEnd < 0 || apiEnd < 0) { console.log('not ok - slice markers'); process.exit(1); }
const layerText = clientSrc.slice(layerStart, layerEnd) + clientSrc.slice(layerEnd, apiEnd)
  + '\n;this.__x = { opnDoc, opnExportText, opnRestoreFromText, opnValidateImport, opnUndoRestore, opnHasSnapshot, opnCountsOf, opnMode, opnPinSet };\n';

function makeWorld(inShell) {
  const storage = new Map();
  const world = {
    console,
    URLSearchParams,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    setTimeout, clearTimeout,
    location: { host: 'app.orapronobis.media', pathname: '/', search: '' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    fetch: () => Promise.reject(new Error('network must not be touched by the local layer')),
    __OPN_SHAPE__: 'public',
    __storage: storage,
  };
  world.window = world;
  world.window.__OPN_SHAPE__ = 'public';
  world.oraInShell = () => inShell;
  world.todayChicago = () => '2026-11-21';
  world.__shape = 'public';
  vm.createContext(world);
  vm.runInContext('window.__OPN_SHAPE__ = __shape;', world);
  vm.runInContext(layerText, world);
  return world;
}
// The slice includes the layer's own api(), which routes to
// the local API in device mode — worlds drive the layer
// through W.api exactly as the client does.

// ---------- L-legs ----------
const johnText = readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import.json', 'utf8');
const johnFile = JSON.parse(johnText);

{ // L1 + L2 + L3 in one device world pair
  const A = makeWorld(true);
  const apiA = A.api;
  await apiA('/api/prayer/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'For A', priority: 'H' }) });
  await apiA('/api/prayer/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'For B', priority: 'M' }) });
  const todayA = await apiA('/api/exam/today'); // opens today's run, as the app's own open does
  await apiA('/api/exam/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: todayA.run.id, promptId: null, category: 'Commandment I', text: 'entry one', kind: 'sin' }) });
  const johnSlug = johnFile.sections.favorites.book[0];
  await apiA('/api/prayer/book/favorites', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: [johnSlug] }) });
  await A.__x.opnPinSet('4271');
  const text = A.__x.opnExportText();
  const env = JSON.parse(text);
  check('L1 envelope format + version', env.format === 'orapronobis-personal-data' && env.formatVersion === 1);
  check('L1 counts header equals sections', JSON.stringify(env.counts) === JSON.stringify(A.__x.opnCountsOf(env)), env.counts);
  check('L1 counts carry the world data', env.counts.intentions === 2 && env.counts.conscienceEntries === 1 && env.counts.favoritesBook === 1, env.counts);
  const pinRaw = A.__storage.get('opn-pin-local-v1') || '';
  const pinRec = pinRaw ? JSON.parse(pinRaw) : {};
  // The secret material proper: the two hash/salt pairs. (The
  // record's createdAt is a plain timestamp — the export's own
  // exportedAt can share its millisecond in a fast world, so a
  // blanket value census false-fires on it; the hashes and
  // salts are the material that must never travel.)
  const pinSecrets = ['pinHash', 'pinSalt', 'recoveryHash', 'recoverySalt'].map((k) => pinRec[k]).filter((v) => typeof v === 'string' && v.length >= 8);
  check('L2 export carries no PIN record material', pinSecrets.length === 4 && pinSecrets.every((s) => !text.includes(s)), Object.keys(pinRec));
  check('L2 export carries no PIN field', !text.includes('pinHash') && !text.includes('"pin"') && !text.includes('4271'));

  const B = makeWorld(true);
  const counts = B.__x.opnRestoreFromText(text);
  check('L3 restore returns the header counts', JSON.stringify(counts) === JSON.stringify(env.counts), counts);
  const apiB = B.api;
  const ints = await apiB('/api/prayer/intentions');
  check('L3 intentions read back', ints.intentions.length === 2 && ints.intentions.some((i) => i.text === 'For A'), ints);
  const exam = await apiB('/api/exam/today');
  check('L3 exam entry reads back', JSON.stringify(exam).includes('entry one'));
  const favs = await apiB('/api/prayer/book/favorites');
  check('L3 book favorite reads back', (favs.favorites || []).includes(johnSlug), favs);
}

{ // L4 + L5 + L6 refusals leave the document untouched
  const C = makeWorld(true);
  C.__x.opnRestoreFromText(johnText);
  const before = JSON.stringify(C.__x.opnDoc().sections);
  const newer = JSON.parse(johnText); newer.formatVersion = 2;
  let msg = '';
  try { C.__x.opnRestoreFromText(JSON.stringify(newer)); } catch (e) { msg = e.message; }
  check('L4 newer formatVersion refused in plain words', msg.includes('newer version of Ora Pro Nobis'), msg);
  check('L4 document untouched', JSON.stringify(C.__x.opnDoc().sections) === before);
  const tampered = JSON.parse(johnText); tampered.counts.intentions += 1;
  msg = '';
  try { C.__x.opnRestoreFromText(JSON.stringify(tampered)); } catch (e) { msg = e.message; }
  check('L5 count-mismatched copy refused', msg.includes('counts do not match'), msg);
  check('L5 document untouched', JSON.stringify(C.__x.opnDoc().sections) === before);
  msg = '';
  try { C.__x.opnRestoreFromText('{"hello":1}'); } catch (e) { msg = e.message; }
  check('L6 foreign file refused', msg.includes('not an Ora Pro Nobis data copy'), msg);
  check('L6 document untouched', JSON.stringify(C.__x.opnDoc().sections) === before);
}

{ // L7 snapshot + undo
  const D = makeWorld(true);
  const apiD = D.api;
  await apiD('/api/prayer/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Marker D', priority: 'M' }) });
  check('L7 no snapshot before a restore', D.__x.opnHasSnapshot() === false);
  D.__x.opnRestoreFromText(johnText);
  check('L7 snapshot stands after a restore', D.__x.opnHasSnapshot() === true);
  let ints = await apiD('/api/prayer/intentions');
  check('L7 restored data stands', ints.intentions.length === 19, ints.intentions.length);
  check('L7 undo reports success', D.__x.opnUndoRestore() === true);
  ints = await apiD('/api/prayer/intentions');
  check('L7 undo brings the pre-restore document back', ints.intentions.length === 1 && ints.intentions[0].text === 'Marker D', ints);
  check('L7 snapshot consumed by undo', D.__x.opnHasSnapshot() === false);
}

{ // L8 + L9 John's file dry-run + seq survival
  const E = makeWorld(true);
  const counts = E.__x.opnRestoreFromText(johnText);
  check('L8 dry-run counts equal the file header', JSON.stringify(counts) === JSON.stringify(johnFile.counts), counts);
  check('L8 header is the Plan set (addenda = day-addition rows, 0 standing)',
    counts.intentions === 19 && counts.conscienceRuns === 13 && counts.conscienceEntries === 2
    && counts.confessions === 0 && counts.profiles === 3 && counts.sourceSettings === 26
    && counts.favoritesBook === 3 && counts.universalPrayerDates === 2 && counts.addenda === 0, counts);
  const apiE = E.api;
  const ints = await apiE('/api/prayer/intentions');
  check('L8 19 intentions read back', ints.intentions.length === 19, ints.intentions.length);
  const profs = await apiE('/api/prayer/profiles');
  check('L8 profiles read back, Salesian standing', (profs.profiles || []).length === 3 && profs.state && profs.state.standingKey === 'salesian', { n: (profs.profiles || []).length, standing: profs.state && profs.state.standingKey });
  const favs = await apiE('/api/prayer/book/favorites');
  check('L8 book favorites read back', (favs.favorites || []).length === 3, favs);
  const upDate = Object.keys(johnFile.sections.config.universalPrayer)[0];
  const up = await apiE('/api/prayer/mass-universal-prayer?date=' + upDate);
  check('L8 Universal Prayer date reads back', (up.intentions || []).length === johnFile.sections.config.universalPrayer[upDate].length, up);
  const added = await apiE('/api/prayer/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'After restore', priority: 'L' }) });
  check('L9 new intention takes id 20 after the restore', !!added && added.id === 20, added);
}

{ // L10 web mode
  const W = makeWorld(false);
  check('L10 web mode reads web off-shell', W.__x.opnMode() === 'web', W.__x.opnMode());
  let werr = null;
  try { await W.api('/api/prayer/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Nope', priority: 'M' }) }); } catch (e) { werr = e; }
  check('L10 web write refused with the pointer', !!werr && !!werr.data && String(werr.data.error || '').includes('lives in the app'), werr && werr.data);
  check('L10 nothing stored on web', !W.__storage.has('opn-personal-data-v1'));
}

console.log(`\n${ok} ok, ${bad} not ok`);
process.exit(bad ? 1 : 0);
