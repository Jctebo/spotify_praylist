// harness-v632.mjs — v632: simplify the standard-prayer
// settings. The Sing the Hours choice leaves the CONFESSION
// PIN section and the PIN record: it stands in its own
// MORNING & EVENING PRAYER section (after PRAYER PLAN) for
// every user of the phone, on its own localStorage store
// (opn-sth-first-v632), seeded on first read from the PIN
// record's retiring sthPrimary field. The Source mapping's
// two Sing the Hours rows name the standing choice.
//
// Legs (Plan §3.5):
//  1. Section stands in a no-PIN world and a PIN-set world
//     alike, immediately after PRAYER PLAN, both options
//     visible, Divine Office marked standing by default.
//  2. Flip: tapping 'Sing the Hours first' writes the new
//     key 'on'; opnSthPrimary628() reads true; the
//     opnExtChoice628 seam follows; tapping back restores.
//  3. Migration: a PIN record in opnPinSave's shape carrying
//     sthPrimary:true (+ a planted biometricPref) seeds the
//     key 'on' on first read, retires the field only, and
//     leaves the rest byte-identical; the no-field companion
//     world (John's shape) seeds 'off'. Storage failure
//     returns the PIN-record read and writes nothing.
//  4. Mapping labels follow the choice, both ways; a Divine
//     Office row's label is unchanged.
//  5. Wording: the painted section carries neither
//     'primary' nor 'fallback' (case-insensitive).
//  6. PIN section shape: #pin-bio-pref (the v622 card)
//     still paints in both session branches, #pin-sth-pref
//     never paints; the web world still paints the pointer.
//
// Fixtures (Improvement D): the mapping rows are the
// client's own OPN_SEED_SOURCES (the production seed the
// server route serves); the PIN-set world is built over
// John's exported document (john-personal-data-import-
// v589.json) by the client's own /api/pin/set route (the
// v622 recipe); the migration fixture is a PIN record
// written through the client's own opnPinSave — the record
// never stands in an export (device-local by design), so
// opnPinSave's shape IS the production shape of the store.
// ◆ legs 1-5 fail on the base client (743a4ef, the v633
// tree this release branches from — client.ts there is
// byte-identical to the v634 merge's, v634 did not touch
// client.ts), pinned by hash per the v622 precedent.
//
// Run: node app/harness-v632.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BASE = '743a4ef23099214bf3ed3e3bbadc8f118a65f1ca';
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};
check('T1 the new store stands: OPN_STH_FIRST_KEY, the re-pointed read, the write helper',
  clientSrc.includes("var OPN_STH_FIRST_KEY = 'opn-sth-first-v632';")
  && clientSrc.includes('function opnSthPrimary628()')
  && clientSrc.includes('function opnSthFirstSet632(sthFirst)'));
check('T2 the write helper writes ONLY the new key (never the PIN record)',
  !grab(clientSrc, 'opnSthFirstSet632').includes('opnPinSave')
  && !grab(clientSrc, 'opnSthFirstSet632').includes('opnPinLoad'));
check('T3 guard: opnExtChoice628 body byte-unchanged vs the base (the seam is re-pointed, never edited)',
  grab(clientSrc, 'opnExtChoice628') === grab(clientOldSrc, 'opnExtChoice628'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T4 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
function renderAppJs(src) {
  const tplStart = src.indexOf('= `') + 3;
  const tplEnd = src.indexOf('\n`;', tplStart);
  if (tplStart < 3 || tplEnd < 0) throw new Error('APP_JS template markers');
  return vm.runInContext('`' + src.slice(tplStart, tplEnd) + '`', vm.createContext({}));
}
const appJs = renderAppJs(clientSrc);
const appJsOld = renderAppJs(clientOldSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T5 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- worlds ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log(ok + ' ok, ' + bad + ' not ok'); process.exit(1); }
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN_KEY = 'opn-pin-local-v1';
const STH_KEY = 'opn-sth-first-v632';
const PIN = '2468';
const HOOK = '\n;window.__opn = { renderSettings: renderSettings, paintSettings: paintSettings, fillPinSection: fillPinSection, opnSthPrimary628: opnSthPrimary628, opnSthFirstSet632: (typeof opnSthFirstSet632 !== "undefined" ? opnSthFirstSet632 : null), opnExtChoice628: opnExtChoice628, settingsFamilyLabel: settingsFamilyLabel, opnPinLoad: opnPinLoad, opnPinSave: opnPinSave, opnLocalApi: opnLocalApi, opnMode: opnMode, opnPinTokenValid: opnPinTokenValid, opnUnlock632: function (pin) { return post("/api/pin/verify", { pin: pin }).then(function (res) { pinToken = res.token; return res; }); }, setRows632: function (r) { settingsRows = r; settingsVersion = 7; } };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The mapping fixture: the client's own production seed.
const SEED_ROWS = (() => {
  // From the RENDERED APP_JS (the served shape — the raw
  // template still carries its \\uXXXX escapes).
  const at = appJs.indexOf('var OPN_SEED_SOURCES = ');
  const end = appJs.indexOf('];', at);
  return vm.runInContext('(' + appJs.slice(at + 'var OPN_SEED_SOURCES = '.length, end + 1) + ')', vm.createContext({}));
})();
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/player/source-settings')) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, shape) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (shape !== 'web') { try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {} }
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function sectionSlice(w) {
  const html = w.document.body.innerHTML;
  const a = html.indexOf('MORNING &amp; EVENING PRAYER');
  if (a < 0) return null;
  const b = html.indexOf('PLAYBACK', a);
  return { html: html.slice(a, b < 0 ? undefined : b), at: a, planAt: html.indexOf('PRAYER PLAN'), playAt: b };
}
function rowByName(w, name) {
  return [...w.document.querySelectorAll('.setrow')].find((el) => (el.querySelector('.setname') || {}).textContent === name) || null;
}

// ---------- build the PIN-set snapshot through the client's own set path (the v622 recipe) ----------
let snap = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: PIN }) }, 'device');
  const made = await until(() => { try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; } }, 10000);
  check('B0 a real vault + PIN record stand over his document through the client\u2019s own set path', made && !!w.localStorage.getItem(PIN_KEY));
  if (made) {
    snap = {};
    for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); snap[k] = w.localStorage.getItem(k); }
  }
  w.close();
}
const snapWith = (fn) => { const s = JSON.parse(JSON.stringify(snap)); if (fn) fn(s); return s; };

// ---------- Leg 1: the section stands — no-PIN world and PIN-set world ----------
async function leg1(js, store, label) {
  const w = makeWorld(js, store);
  await sleep(400);
  w.__opn.setRows632(SEED_ROWS);
  w.__opn.paintSettings();
  await sleep(300);
  const sec = sectionSlice(w);
  const doRow = rowByName(w, 'Divine Office first');
  const sthRow = rowByName(w, 'Sing the Hours first');
  const out = {
    stood: !!sec,
    ordered: !!sec && sec.planAt >= 0 && sec.planAt < sec.at && sec.at < sec.playAt,
    bothVisible: !!doRow && !!sthRow,
    doStanding: !!doRow && /Standing/.test(doRow.textContent) && !doRow.querySelector('button'),
    sthTappable: !!sthRow && !/Standing/.test(sthRow.textContent) && !!sthRow.querySelector('button'),
    lead: !!sec && sec.html.includes('Which reading of the office plays first for Morning Prayer and Evening Prayer:'),
    foot: !!sec && sec.html.includes('The other hours of the Divine Office have no second source and are not affected.'),
    keySeeded: w.localStorage.getItem(STH_KEY),
    w,
  };
  return out;
}
{
  const a = await leg1(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, 'no-PIN');
  check('L1 ◆ [v637: reversed by name — the Settings section is retired; the choice\u2019s one door stands in the Praylist edit form, harness-v637 L1] no-PIN world: NO MORNING & EVENING PRAYER section stands in Settings, no set-sth-first buttons paint',
    !a.stood && !a.doRow && !a.w.document.getElementById('set-sth-first-do') && !a.w.document.getElementById('set-sth-first-sth'),
    { stood: a.stood });
  check('L1b the no-PIN paint seeds the new key at the default (\'off\')', a.keySeeded === 'off', a.keySeeded);
  a.w.close();
}
if (snap) {
  const b = await leg1(appJs, snapWith(), 'PIN-set');
  check('L1c ◆ [v637: reversed by name — as L1] PIN-set world: NO MORNING & EVENING PRAYER section stands in Settings either',
    !b.stood && !b.doRow, { stood: b.stood });
  check('L1d the PIN-set paint seeds \'off\' from a record carrying no sthPrimary (John\u2019s shape)', b.keySeeded === 'off', b.keySeeded);
  b.w.close();
  const old = await leg1(appJsOld, snapWith(), 'base');
  check('L1-old ◆ REPRODUCED on the base client: no MORNING & EVENING PRAYER section stands at all',
    !old.stood && !old.doRow, { stood: old.stood });
  old.w.close();
}

// ---------- Leg 2: the flip — key, helper, choice seam, mapping label in the same paint ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  w.__opn.setRows632(SEED_ROWS);
  w.__opn.paintSettings();
  await sleep(300);
  const slot = { slotId: 'ext-morning-prayer', title: 'Morning Prayer' };
  const entry = { title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', source: 'Divine Office', backup: { streamUrl: 'https://sth.example/lauds.mp3', source: 'Sing the Hours' } };
  const before = w.__opn.opnExtChoice628(slot, entry, 'Divine Office');
  // v637: reversed by name — the Settings tap target is
  // retired with the section; the flip is driven through
  // the ONE writer, exactly as the edit-form door drives
  // it (harness-v637 L2 proves the tap itself), then
  // Settings repaints as its standing repaint does.
  w.__opn.opnSthFirstSet632(true);
  w.__opn.paintSettings();
  const repainted = await until(() => { const r = w.document.querySelector('[data-setkey="sth-lauds"]'); return r && r.querySelector('.meta').textContent === 'Morning & Evening choice: stands first'; }, 8000);
  await sleep(200);
  const keyOn = w.localStorage.getItem(STH_KEY);
  const after = w.__opn.opnExtChoice628(slot, entry, 'Divine Office');
  const sthRowEl = w.document.querySelector('[data-setkey="sth-lauds"]');
  const labelAfter = sthRowEl ? sthRowEl.querySelector('.meta').textContent : null;
  check('L2 ◆ [v637: reversed by name — flip driven through the one writer, not a Settings tap] key writes \'on\', the helper reads true, the choice seam stands Sing the Hours first with Divine Office as backup',
    repainted && keyOn === 'on' && w.__opn.opnSthPrimary628() === true
    && before.streamUrl === 'https://do.example/mp.mp3'
    && after.streamUrl === 'https://sth.example/lauds.mp3' && after.source === 'Sing the Hours'
    && after.backup && after.backup.streamUrl === 'https://do.example/mp.mp3',
    { repainted, keyOn, after: after.streamUrl, labelAfter });
  check('L2b ◆ [v637: reversed by name — no section marker stands to move] the Settings repaint moves the mapping label (Sing the Hours row reads \'stands first\') and no choice section stands',
    repainted && !sectionSlice(w) && labelAfter === 'Morning & Evening choice: stands first', { labelAfter });
  w.__opn.opnSthFirstSet632(false);
  w.__opn.paintSettings();
  const back = await until(() => { const r = w.document.querySelector('[data-setkey="sth-lauds"]'); return r && r.querySelector('.meta').textContent === 'Morning & Evening choice: stands as the backup'; }, 8000);
  await sleep(200);
  const backChoice = w.__opn.opnExtChoice628(slot, entry, 'Divine Office');
  check('L2c [v637: reversed by name — as L2] flipping back restores \'off\' and the default order',
    back && w.localStorage.getItem(STH_KEY) === 'off' && w.__opn.opnSthPrimary628() === false && backChoice.streamUrl === 'https://do.example/mp.mp3',
    { back, key: w.localStorage.getItem(STH_KEY) });
  w.close();
}

// ---------- Leg 3: migration — factory legs over the real functions ----------
function factory632(src, env) {
  const keyDecl = (src.match(/var OPN_STH_FIRST_KEY = '[^']+';/) || [''])[0];
  const body = keyDecl + '\n' + grab(src, 'opnSthPrimary628') + '\n' + grab(src, 'opnSthFirstSet632');
  const f = new Function('localStorage', 'opnPinLoad', 'opnPinSave', body + '\nreturn { read: opnSthPrimary628, set: opnSthFirstSet632 };');
  return f(env.store, env.load, env.save);
}
function memStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
{
  // 3a: the flipped phone — sthPrimary:true + planted biometricPref.
  let rec = { saltHex: 'ab12', hashHex: 'cd34', iterations: 210000, sthPrimary: true, biometricPref: false, planted632: 'keep-me' };
  let saves = 0; const store = memStore();
  const api = factory632(clientSrc, { store, load: () => rec, save: (r) => { saves++; rec = r; } });
  const first = api.read();
  const savedJson = JSON.stringify(rec);
  check('L3 ◆ migration: first read returns true, the key stands \'on\', the field retires, biometricPref + every other field byte-identical',
    first === true && store.getItem(STH_KEY) === 'on' && saves === 1
    && !Object.prototype.hasOwnProperty.call(rec, 'sthPrimary')
    && savedJson === '{"saltHex":"ab12","hashHex":"cd34","iterations":210000,"biometricPref":false,"planted632":"keep-me"}',
    { first, key: store.getItem(STH_KEY), saves, savedJson });
  const second = api.read();
  check('L3b the second read comes from the key alone (no further PIN save)', second === true && saves === 1, { second, saves });
}
{
  // 3b: John's shape — no sthPrimary field at all.
  const rec = { saltHex: 'ab12', hashHex: 'cd34', iterations: 210000, biometricPref: true };
  const beforeJson = JSON.stringify(rec);
  let saves = 0; const store = memStore();
  const api = factory632(clientSrc, { store, load: () => rec, save: () => { saves++; } });
  const v = api.read();
  check('L3c ◆ companion world: no-field record reads false, seeds \'off\', and the record is never rewritten',
    v === false && store.getItem(STH_KEY) === 'off' && saves === 0 && JSON.stringify(rec) === beforeJson,
    { v, key: store.getItem(STH_KEY), saves });
}
{
  // 3c: storage failure — the PIN read stands, nothing writes.
  let saves = 0;
  const dead = { getItem: () => { throw new Error('storage dead'); }, setItem: () => { throw new Error('storage dead'); } };
  const api = factory632(clientSrc, { store: dead, load: () => ({ sthPrimary: true }), save: () => { saves++; } });
  let v = null, threw = false;
  try { v = api.read(); } catch (e) { threw = true; }
  check('L3d ◆ storage failure: the read falls back to the PIN record and writes nothing',
    !threw && v === true && saves === 0, { v, threw, saves });
}
{
  // 3d: the key already stands — the PIN record is not consulted for the value.
  let rec = { sthPrimary: false, biometricPref: false };
  let saves = 0; const store = memStore({ [STH_KEY]: 'on' });
  const api = factory632(clientSrc, { store, load: () => rec, save: () => { saves++; } });
  check('L3e a standing key governs: read true with sthPrimary:false on the record, record untouched',
    api.read() === true && saves === 0 && rec.sthPrimary === false, { saves });
  // 3-old: the base has no key, no setter — the migration cannot stand there.
  check('L3-old ◆ REPRODUCED on the base client: no OPN_STH_FIRST_KEY and no opnSthFirstSet632 stand',
    !clientOldSrc.includes('OPN_STH_FIRST_KEY') && !clientOldSrc.includes('opnSthFirstSet632'));
}

// ---------- Leg 4: mapping labels ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const lauds = SEED_ROWS.find((r) => r.sourceKey === 'sth-lauds');
  const vespers = SEED_ROWS.find((r) => r.sourceKey === 'sth-vespers');
  const doMp = SEED_ROWS.find((r) => r.sourceKey === 'do-morning-prayer');
  const atDefault = w.__opn.settingsFamilyLabel(lauds);
  const doDefault = w.__opn.settingsFamilyLabel(doMp);
  w.__opn.opnSthFirstSet632(true);
  const atFlip = w.__opn.settingsFamilyLabel(lauds);
  const atFlipV = w.__opn.settingsFamilyLabel(vespers);
  const doFlip = w.__opn.settingsFamilyLabel(doMp);
  check('L4 ◆ labels follow the choice: \'stands as the backup\' at default, \'stands first\' after the flip, both Sing the Hours rows',
    atDefault === 'Morning & Evening choice: stands as the backup' && atFlip === 'Morning & Evening choice: stands first' && atFlipV === 'Morning & Evening choice: stands first',
    { atDefault, atFlip });
  check('L4b a Divine Office row\u2019s label is byte-unchanged both ways', doDefault === 'Divine Office' && doFlip === 'Divine Office', { doDefault, doFlip });
  w.close();
  const wo = makeWorld(appJsOld, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const laudsOld = SEED_ROWS.find((r) => r.sourceKey === 'sth-lauds');
  check('L4-old ◆ REPRODUCED on the base client: the label stands at the fixed \'fallback only\' wording',
    wo.__opn.settingsFamilyLabel(laudsOld) === 'Sing the Hours — fallback only', wo.__opn.settingsFamilyLabel(laudsOld));
  wo.close();
}

// ---------- Leg 5: wording — scoped to the painted section ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  w.__opn.setRows632(SEED_ROWS);
  w.__opn.paintSettings();
  await sleep(300);
  const sec = sectionSlice(w);
  check('L5 ◆ [v637: reversed by name — the section itself is retired; the wording rule re-proves on the edit-form door in harness-v637 L4c] no Morning & Evening section paints in Settings at all',
    !sec, sec ? sec.html.slice(0, 200) : null);
  w.close();
}

// ---------- Leg 6: PIN section shape — both session branches + web world ----------
if (snap) {
  const wu = makeWorld(appJs, snapWith());
  await sleep(400);
  await wu.__opn.opnUnlock632(PIN).catch(() => {});
  const tokenUp = await until(() => wu.__opn.opnPinTokenValid(), 8000);
  const hostU = wu.document.createElement('div'); hostU.id = 'pin-section'; wu.document.body.appendChild(hostU);
  wu.__opn.fillPinSection();
  const bioStoodU = await until(() => !!wu.document.getElementById('pin-bio-pref'), 8000);
  check('L6a ◆ unlocked branch: the v622 fingerprint card stands and the Sing the Hours card is GONE',
    tokenUp && bioStoodU && !!wu.document.getElementById('pin-change-open') && !wu.document.getElementById('pin-sth-pref'),
    { tokenUp, bioStoodU, unlocked: !!wu.document.getElementById('pin-change-open'), sth: !!wu.document.getElementById('pin-sth-pref') });
  wu.close();
}
if (snap) {
  const w = makeWorld(appJs, snapWith());
  await sleep(400);
  const host = w.document.createElement('div'); host.id = 'pin-section'; w.document.body.appendChild(host);
  w.__opn.fillPinSection();
  const bioStood = await until(() => !!w.document.getElementById('pin-bio-pref'), 8000);
  check('L6b ◆ locked branch: the v622 card stands, #pin-sth-pref never paints',
    bioStood && !!w.document.getElementById('pin-enter-open') && !w.document.getElementById('pin-sth-pref'),
    { bioStood, locked: !!w.document.getElementById('pin-enter-open'), sth: !!w.document.getElementById('pin-sth-pref') });
  w.close();
  const wo = makeWorld(appJsOld, snapWith());
  await sleep(400);
  const hostO = wo.document.createElement('div'); hostO.id = 'pin-section'; wo.document.body.appendChild(hostO);
  wo.__opn.fillPinSection();
  const sthStoodOld = await until(() => !!wo.document.getElementById('pin-sth-pref'), 8000);
  check('L6-old ◆ REPRODUCED on the base client: the Sing the Hours card stands inside CONFESSION PIN',
    sthStoodOld, { sthStoodOld });
  wo.close();
}
{
  const w = makeWorld(appJs, {}, 'web');
  await sleep(400);
  const host = w.document.createElement('div'); host.id = 'pin-section'; w.document.body.appendChild(host);
  w.__opn.fillPinSection();
  const pointer = await until(() => /CONFESSION PIN/.test(host.innerHTML) && !w.document.getElementById('pin-bio-pref'), 8000);
  check('L6c ◆ web world: the section stands as the pointer, no PIN controls, no Sing the Hours card',
    pointer && w.__opn.opnMode() === 'web' && !w.document.getElementById('pin-sth-pref') && !w.document.getElementById('pin-set-open'),
    { mode: w.__opn.opnMode(), html: host.innerHTML.slice(0, 160) });
  w.close();
}

console.log('\nharness-v632:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
